import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';
import { CreatePilotApplicationDto } from './dto/create-pilot-application.dto';
import {
  PILOT_APPLICATION_STATUSES,
  UpdatePilotApplicationDto,
} from './dto/update-pilot-application.dto';

const SUCCESS_MESSAGE = "Thanks. We'll review your clinic and reply within 2 business days.";
const PILOT_SETUP_TOKEN_HOURS = 168; // 7 days
const PILOT_SETUP_TOKEN_TYPE = 'PASSWORD_RESET';

@Injectable()
export class PilotApplicationService {
  private readonly logger = new Logger(PilotApplicationService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private email: EmailService,
    private tokens: TokenService,
  ) {}

  async create(
    dto: CreatePilotApplicationDto,
    context: { referrer?: string; userAgent?: string },
  ): Promise<{ accepted: true; message: string }> {
    if (this.shouldSilentlyAccept(dto)) {
      return { accepted: true, message: SUCCESS_MESSAGE };
    }

    const application = await this.prisma.pilotApplication.create({
      data: {
        clinicName: dto.clinicName.trim(),
        contactName: dto.contactName.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        websiteOrInstagram: dto.websiteOrInstagram?.trim() || null,
        countryTimezone: dto.countryTimezone?.trim() || null,
        monthlyLeadVolume: dto.monthlyLeadVolume || null,
        currentChannels: dto.currentChannels || [],
        biggestFrontDeskPain: dto.biggestFrontDeskPain.trim(),
        practiceType: dto.practiceType,
        consent: dto.consent,
        utmSource: dto.utmSource?.trim() || null,
        utmMedium: dto.utmMedium?.trim() || null,
        utmCampaign: dto.utmCampaign?.trim() || null,
        referrer: context.referrer || null,
        userAgent: context.userAgent || null,
      },
    });

    await this.notify(application).catch((err) =>
      this.logger.warn(`Pilot application notification failed: ${err?.message}`),
    );

    return { accepted: true, message: SUCCESS_MESSAGE };
  }

  async findAll(query: { status?: string; search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = {};

    if (query.status && PILOT_APPLICATION_STATUSES.includes(query.status as any)) {
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const contains = query.search.trim();
      where.OR = [
        { clinicName: { contains, mode: 'insensitive' } },
        { contactName: { contains, mode: 'insensitive' } },
        { email: { contains, mode: 'insensitive' } },
        { websiteOrInstagram: { contains, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.pilotApplication.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pilotApplication.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async update(id: string, dto: UpdatePilotApplicationDto) {
    const existing = await this.prisma.pilotApplication.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pilot application not found');

    const data: Record<string, unknown> = {};
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (dto.status && dto.status !== existing.status) {
      data.status = dto.status;
      const now = new Date();
      if (dto.status === 'CONTACTED') data.contactedAt = now;
      if (dto.status === 'ACCEPTED') data.acceptedAt = now;
      if (dto.status === 'REJECTED') data.rejectedAt = now;
    }

    return this.prisma.pilotApplication.update({
      where: { id },
      data,
    });
  }

  /**
   * Provision the pilot Business + Owner Staff from an accepted application.
   * Idempotent: re-running on an already-accepted application returns the
   * existing businessId and skips the email/token resend.
   */
  async acceptApplicationAndProvision(
    id: string,
  ): Promise<{ businessId: string; ownerStaffId: string; setupTokenSent: boolean }> {
    const application = await this.prisma.pilotApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Pilot application not found');

    // Idempotency: if already accepted with a provisioned business, return early
    if (application.status === 'ACCEPTED' && application.acceptedBusinessId) {
      const existingOwner = await this.prisma.staff.findFirst({
        where: { businessId: application.acceptedBusinessId, role: 'OWNER' },
        select: { id: true },
      });
      return {
        businessId: application.acceptedBusinessId,
        ownerStaffId: existingOwner?.id || '',
        setupTokenSent: false,
      };
    }

    const ownerEmail = application.email.trim().toLowerCase();
    const baseSlug = this.slugify(application.clinicName) || 'clinic';

    // Run Business + Staff + PilotApplication updates in a single transaction so
    // a partial failure (e.g., duplicate staff email) rolls back the Business.
    const { businessId, ownerStaffId } = await this.prisma.$transaction(async (tx) => {
      const slug = await this.findUniqueSlug(tx, baseSlug);

      const business = await tx.business.create({
        data: {
          name: application.clinicName,
          slug,
          verticalPack: 'aesthetic',
          timezone: application.countryTimezone || 'UTC',
          // businessHours intentionally omitted — null = always-open / no after-hours rule
        },
      });

      const owner = await tx.staff.create({
        data: {
          businessId: business.id,
          email: ownerEmail,
          name: application.contactName,
          role: 'OWNER',
          isActive: true,
          emailVerified: false,
          passwordHash: null,
          locale: 'en',
        },
      });

      await tx.pilotApplication.update({
        where: { id: application.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedBusinessId: business.id,
        },
      });

      return { businessId: business.id, ownerStaffId: owner.id };
    });

    // Token + email happen post-commit so a delivery failure does not roll back the provision.
    let setupTokenSent = false;
    try {
      const token = await this.tokens.createToken(
        PILOT_SETUP_TOKEN_TYPE,
        ownerEmail,
        businessId,
        ownerStaffId,
        PILOT_SETUP_TOKEN_HOURS,
      );
      const setupUrl = `${this.getWebUrl()}/reset-password?token=${token}`;
      await this.sendPilotWelcomeEmail({
        to: ownerEmail,
        contactName: application.contactName,
        setupUrl,
      });
      setupTokenSent = true;
    } catch (err: any) {
      this.logger.error(
        `Pilot welcome email/token failed for ${ownerEmail} (business ${businessId}): ${err?.message}`,
      );
    }

    return { businessId, ownerStaffId, setupTokenSent };
  }

  /**
   * Move a non-MED_SPA application onto the year-2 waitlist and notify the applicant.
   */
  async addToYear2Waitlist(id: string) {
    const application = await this.prisma.pilotApplication.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Pilot application not found');

    const updated = await this.prisma.pilotApplication.update({
      where: { id },
      data: { status: 'WAITLIST_YEAR_2' },
    });

    await this.sendYear2WaitlistEmail({
      to: application.email,
      contactName: application.contactName,
      practiceType: application.practiceType,
    }).catch((err) =>
      this.logger.warn(
        `Year-2 waitlist email failed for ${application.email}: ${err?.message || err}`,
      ),
    );

    return updated;
  }

  private shouldSilentlyAccept(dto: CreatePilotApplicationDto): boolean {
    if (dto.company?.trim()) return true;
    if (!dto.consent) return true;
    if (!dto.startedAt) return false;

    const startedAt = new Date(dto.startedAt).getTime();
    if (Number.isNaN(startedAt)) return true;
    return Date.now() - startedAt < 3000;
  }

  private async notify(application: any) {
    const to = this.config.get<string>('PILOT_APPLICATION_NOTIFY_EMAIL');
    if (!to) {
      this.logger.log(`Pilot application received from ${application.email}; notification unset`);
      return;
    }

    const channels = application.currentChannels?.length
      ? application.currentChannels.join(', ')
      : 'Not provided';
    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">New Pilot Application</h2>
<p style="margin:0 0 20px 0;color:#64748B;">A clinic applied for the Business Command Centre AI Front Desk pilot.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7F5;border-radius:12px;padding:20px;margin-bottom:20px;">
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Clinic</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${this.escape(application.clinicName)}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Contact</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${this.escape(application.contactName)}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Email</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${this.escape(application.email)}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Phone</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${this.escape(application.phone || 'Not provided')}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Channels</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${this.escape(channels)}</td></tr>
</table>
<p style="margin:0 0 8px 0;font-size:14px;color:#64748B;"><strong>Front desk pain:</strong></p>
<p style="margin:0;font-size:14px;color:#1E293B;">${this.escape(application.biggestFrontDeskPain)}</p>`;

    await this.email.send({
      to,
      subject: this.sanitizeHeader(`New pilot application: ${application.clinicName}`),
      html: this.email.buildBrandedHtml(body),
    });
  }

  private async sendPilotWelcomeEmail(opts: { to: string; contactName: string; setupUrl: string }) {
    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">Welcome to your AI Front Desk pilot</h2>
<p style="margin:0 0 16px 0;color:#1E293B;">Hi ${this.escape(opts.contactName)},</p>
<p style="margin:0 0 16px 0;color:#1E293B;">Your 30-day Business Command Centre AI Front Desk pilot is live. We will spend the next 30 days catching after-hours leads, replying within 60 seconds, and putting captured-vs-would-have-been-missed numbers in your weekly recap.</p>
<p style="margin:0 0 24px 0;color:#1E293B;">Click below to set your password and finish onboarding. The link expires in 7 days.</p>
<p style="margin:0 0 24px 0;">
<a href="${opts.setupUrl}" style="display:inline-block;padding:14px 32px;background-color:#71907C;color:#FFFFFF;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;">Set up your account</a>
</p>
<p style="margin:0 0 8px 0;font-size:14px;color:#64748B;">If the button does not work, paste this URL into your browser:</p>
<p style="margin:0 0 16px 0;font-size:13px;color:#94A3B8;word-break:break-all;">${opts.setupUrl}</p>
<p style="margin:0;font-size:13px;color:#94A3B8;">Questions? Just reply to this email — your founder concierge will see it.</p>`;

    await this.email.send({
      to: opts.to,
      subject: this.sanitizeHeader('Welcome to your AI Front Desk pilot'),
      html: this.email.buildBrandedHtml(body),
    });
  }

  private async sendYear2WaitlistEmail(opts: {
    to: string;
    contactName: string;
    practiceType: string | null;
  }) {
    const practiceLabel = opts.practiceType
      ? this.escape(opts.practiceType.replace(/_/g, ' ').toLowerCase())
      : 'your practice type';
    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">Thanks for applying — Year 2 waitlist</h2>
<p style="margin:0 0 16px 0;color:#1E293B;">Hi ${this.escape(opts.contactName)},</p>
<p style="margin:0 0 16px 0;color:#1E293B;">Thank you for applying to the Business Command Centre AI Front Desk pilot. Year 1 of the pilot is limited to medical spas so we can deeply tune the AI for one practice type before opening up.</p>
<p style="margin:0 0 16px 0;color:#1E293B;">We have added you to our Year 2 waitlist for ${practiceLabel}, and will email you the moment we open applications for your practice type.</p>
<p style="margin:0;font-size:13px;color:#94A3B8;">If anything changes on your end, feel free to reply to this email.</p>`;

    await this.email.send({
      to: opts.to,
      subject: this.sanitizeHeader('Thanks for applying — Year 2 waitlist'),
      html: this.email.buildBrandedHtml(body),
    });
  }

  private getWebUrl(): string {
    return (
      this.config.get<string>('APP_URL') ||
      this.config.get<string>('WEB_URL') ||
      'http://localhost:3000'
    );
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private async findUniqueSlug(
    tx: { business: { findUnique: (args: any) => Promise<any> } },
    base: string,
  ): Promise<string> {
    const existing = await tx.business.findUnique({ where: { slug: base } });
    if (!existing) return base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
      const conflict = await tx.business.findUnique({ where: { slug: candidate } });
      if (!conflict) return candidate;
    }
    // Last-resort fallback uses timestamp suffix
    return `${base}-${Date.now().toString(36)}`;
  }

  private sanitizeHeader(value: string): string {
    return value.replace(/[\r\n]+/g, ' ').slice(0, 200);
  }

  private escape(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
