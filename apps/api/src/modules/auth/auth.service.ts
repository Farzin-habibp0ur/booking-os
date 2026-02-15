import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private tokenService: TokenService,
    private emailService: EmailService,
  ) {}

  private getRefreshSecret(): string {
    return this.config.get<string>('JWT_REFRESH_SECRET')
      || this.config.get<string>('JWT_SECRET')
      || 'dev-secret-change-in-production';
  }

  private issueTokens(staff: { id: string; email: string; businessId: string; role: string }) {
    const payload = {
      sub: staff.id,
      email: staff.email,
      businessId: staff.businessId,
      role: staff.role,
    };

    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: this.jwt.sign(payload, {
        secret: this.getRefreshSecret(),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    };
  }

  private getWebUrl(): string {
    return this.config.get<string>('WEB_URL') || 'http://localhost:3000';
  }

  async signup(data: { businessName: string; ownerName: string; email: string; password: string }) {
    const existing = await this.prisma.staff.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const slug = data.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);

    const passwordHash = await bcrypt.hash(data.password, 10);

    const business = await this.prisma.business.create({
      data: { name: data.businessName, slug },
    });

    const staff = await this.prisma.staff.create({
      data: {
        businessId: business.id,
        name: data.ownerName,
        email: data.email,
        passwordHash,
        role: 'OWNER',
      },
    });

    const tokens = this.issueTokens(staff);

    return {
      ...tokens,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        businessId: staff.businessId,
      },
    };
  }

  async login(email: string, password: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!staff || !staff.isActive || !staff.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, staff.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.issueTokens(staff);

    return {
      ...tokens,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        businessId: staff.businessId,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.getRefreshSecret(),
      });
      const staff = await this.prisma.staff.findUnique({
        where: { id: payload.sub },
      });
      if (!staff || !staff.isActive) {
        throw new UnauthorizedException();
      }
      return this.issueTokens(staff);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { business: true },
    });
    if (!staff) throw new UnauthorizedException();
    return {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      locale: staff.locale,
      businessId: staff.businessId,
      business: {
        id: staff.business.id,
        name: staff.business.name,
        slug: staff.business.slug,
        verticalPack: staff.business.verticalPack,
        defaultLocale: staff.business.defaultLocale,
      },
    };
  }

  async forgotPassword(email: string) {
    const staff = await this.prisma.staff.findUnique({ where: { email } });

    // Always return ok to prevent email enumeration
    if (!staff || !staff.isActive) return { ok: true };

    // Revoke any existing reset tokens for this email
    await this.tokenService.revokeTokens(email, 'PASSWORD_RESET');

    const token = await this.tokenService.createToken(
      'PASSWORD_RESET',
      email,
      staff.businessId,
      staff.id,
      1, // 1 hour expiry
    );

    const resetUrl = `${this.getWebUrl()}/reset-password?token=${token}`;
    await this.emailService.sendPasswordReset(email, { name: staff.name, resetUrl });

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenRecord = await this.tokenService.validateToken(token, 'PASSWORD_RESET');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.staff.update({
      where: { id: tokenRecord.staffId! },
      data: { passwordHash },
    });

    await this.tokenService.markUsed(tokenRecord.id);

    return { ok: true };
  }

  async changePassword(staffId: string, currentPassword: string, newPassword: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || !staff.passwordHash) throw new BadRequestException('Cannot change password');

    const valid = await bcrypt.compare(currentPassword, staff.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { passwordHash },
    });

    return { ok: true };
  }

  async acceptInvite(token: string, password: string) {
    const tokenRecord = await this.tokenService.validateToken(token, 'STAFF_INVITE');

    const staff = await this.prisma.staff.findUnique({
      where: { id: tokenRecord.staffId! },
    });

    if (!staff) throw new BadRequestException('Staff member not found');

    const passwordHash = await bcrypt.hash(password, 10);
    const updatedStaff = await this.prisma.staff.update({
      where: { id: staff.id },
      data: { passwordHash, isActive: true },
    });

    await this.tokenService.markUsed(tokenRecord.id);

    const tokens = this.issueTokens(updatedStaff);

    return {
      ...tokens,
      staff: {
        id: updatedStaff.id,
        name: updatedStaff.name,
        email: updatedStaff.email,
        role: updatedStaff.role,
        businessId: updatedStaff.businessId,
      },
    };
  }
}
