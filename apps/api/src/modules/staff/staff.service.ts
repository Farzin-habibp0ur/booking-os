import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  private getWebUrl(): string {
    return this.config.get<string>('WEB_URL') || 'http://localhost:3000';
  }

  async findAll(businessId: string) {
    return this.prisma.staff.findMany({
      where: { businessId },
      select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }).then(staff => staff.map(s => ({
      ...s,
      invitePending: !s.passwordHash && s.isActive,
      passwordHash: undefined,
    })));
  }

  async create(businessId: string, data: { name: string; email: string; password: string; role: string }) {
    const existing = await this.prisma.staff.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.staff.create({
      data: { businessId, name: data.name, email: data.email, passwordHash, role: data.role },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
  }

  async update(businessId: string, id: string, data: { name?: string; email?: string; role?: string }) {
    return this.prisma.staff.update({
      where: { id, businessId },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }

  async deactivate(businessId: string, id: string) {
    return this.prisma.staff.update({
      where: { id, businessId },
      data: { isActive: false },
    });
  }

  async inviteStaff(businessId: string, data: { email: string; name: string; role?: string }) {
    const existing = await this.prisma.staff.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    // Create staff without password
    const staff = await this.prisma.staff.create({
      data: {
        businessId,
        name: data.name,
        email: data.email,
        role: data.role || 'AGENT',
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    // Create invitation token (48 hours)
    const token = await this.tokenService.createToken(
      'STAFF_INVITE',
      data.email,
      businessId,
      staff.id,
      48,
    );

    const inviteUrl = `${this.getWebUrl()}/accept-invite?token=${token}`;
    await this.emailService.sendStaffInvitation(data.email, {
      name: data.name,
      businessName: business.name,
      inviteUrl,
    });

    return { ...staff, invitePending: true };
  }

  async resendInvite(businessId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
      include: { business: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.passwordHash) throw new ConflictException('Staff has already set their password');

    // Revoke old tokens and create new one
    await this.tokenService.revokeTokens(staff.email, 'STAFF_INVITE');
    const token = await this.tokenService.createToken(
      'STAFF_INVITE',
      staff.email,
      businessId,
      staffId,
      48,
    );

    const inviteUrl = `${this.getWebUrl()}/accept-invite?token=${token}`;
    await this.emailService.sendStaffInvitation(staff.email, {
      name: staff.name,
      businessName: staff.business.name,
      inviteUrl,
    });

    return { ok: true };
  }

  async revokeInvite(businessId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    await this.tokenService.revokeTokens(staff.email, 'STAFF_INVITE');
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    return { ok: true };
  }
}
