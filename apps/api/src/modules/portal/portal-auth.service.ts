import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { PortalRedisService } from '../../common/portal-redis.service';
import { EmailService } from '../email/email.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

interface OtpEntry {
  otp: string;
  customerId: string;
  businessId: string;
  attempts: number;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;
const PORTAL_TOKEN_EXPIRY = '24h';
const MAGIC_LINK_EXPIRY = '1h';

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
    private redisStore: PortalRedisService,
    @Inject('QUEUE_AVAILABLE') private queueAvailable: boolean,
    @Optional()
    @InjectQueue(QUEUE_NAMES.MESSAGING)
    private messagingQueue?: Queue,
  ) {}

  private otpKey(businessId: string, phone: string): string {
    return `portal-otp:${businessId}:${phone}`;
  }

  private generateOtp(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async resolveBusiness(slug: string) {
    const business = await this.prisma.business.findFirst({ where: { slug } });
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  async requestOtp(slug: string, phone: string): Promise<{ message: string }> {
    const business = await this.resolveBusiness(slug);

    const customer = await this.prisma.customer.findFirst({
      where: { businessId: business.id, phone },
    });
    if (!customer) {
      throw new NotFoundException('No account found with this phone number');
    }

    const otp = this.generateOtp();
    const key = this.otpKey(business.id, phone);

    const entry: OtpEntry = {
      otp,
      customerId: customer.id,
      businessId: business.id,
      attempts: 0,
    };
    await this.redisStore.set(key, JSON.stringify(entry), OTP_TTL_MS);

    // Enqueue WhatsApp message
    if (this.queueAvailable && this.messagingQueue) {
      await this.messagingQueue.add('portal-otp', {
        to: phone,
        businessId: business.id,
        message: `Your ${business.name} portal code is: ${otp}. Expires in 5 minutes.`,
      });
    }

    this.logger.log(`OTP sent to ${phone} for business ${business.slug}`);
    return { message: 'Verification code sent' };
  }

  async verifyOtp(slug: string, phone: string, otp: string): Promise<{ token: string }> {
    const business = await this.resolveBusiness(slug);
    const key = this.otpKey(business.id, phone);
    const raw = await this.redisStore.get(key);

    if (!raw) {
      throw new UnauthorizedException('No verification code found. Please request a new one.');
    }

    const entry: OtpEntry = JSON.parse(raw);

    if (entry.attempts >= MAX_OTP_ATTEMPTS) {
      await this.redisStore.del(key);
      throw new UnauthorizedException('Too many failed attempts. Please request a new code.');
    }

    if (entry.otp !== otp) {
      entry.attempts++;
      await this.redisStore.set(key, JSON.stringify(entry), OTP_TTL_MS);
      throw new UnauthorizedException('Invalid verification code');
    }

    // OTP valid — delete and issue token
    await this.redisStore.del(key);

    const token = this.jwt.sign(
      {
        sub: entry.customerId,
        customerId: entry.customerId,
        businessId: entry.businessId,
        type: 'portal',
      },
      { expiresIn: PORTAL_TOKEN_EXPIRY },
    );

    return { token };
  }

  async requestMagicLink(slug: string, email: string): Promise<{ message: string }> {
    const business = await this.resolveBusiness(slug);

    const customer = await this.prisma.customer.findFirst({
      where: { businessId: business.id, email },
    });
    if (!customer) {
      throw new NotFoundException('No account found with this email');
    }

    const token = this.jwt.sign(
      {
        sub: customer.id,
        customerId: customer.id,
        businessId: business.id,
        type: 'magic-link',
      },
      { expiresIn: MAGIC_LINK_EXPIRY },
    );

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
    const link = `${webUrl}/portal/${slug}?magic_token=${token}`;

    await this.emailService.send({
      to: email,
      subject: `Sign in to ${business.name} Portal`,
      html: this.emailService.buildBrandedHtml(`
        <h2>Sign in to your portal</h2>
        <p>Click the link below to access your ${business.name} customer portal. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#71907C;color:white;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:500;">Sign In</a>
        <p style="margin-top:16px;font-size:12px;color:#94a3b8;">If you didn't request this, you can safely ignore this email.</p>
      `),
    });

    return { message: 'Magic link sent to your email' };
  }

  async verifyMagicLink(token: string): Promise<{ token: string }> {
    try {
      const payload = this.jwt.verify(token);

      if (payload.type !== 'magic-link') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Verify customer still exists
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.customerId },
      });
      if (!customer) {
        throw new UnauthorizedException('Customer not found');
      }

      const portalToken = this.jwt.sign(
        {
          sub: payload.customerId,
          customerId: payload.customerId,
          businessId: payload.businessId,
          type: 'portal',
        },
        { expiresIn: PORTAL_TOKEN_EXPIRY },
      );

      return { token: portalToken };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired magic link');
    }
  }

  // Expose for testing
  getRedisStore() {
    return this.redisStore;
  }
}
