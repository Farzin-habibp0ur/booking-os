import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private failedAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

  // M2 fix: Periodic cleanup of stale brute force entries to prevent memory leak
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private tokenService: TokenService,
    private emailService: EmailService,
  ) {
    // M2 fix: Clean up expired brute force entries every 5 minutes
    const timer = setInterval(
      () => {
        const now = new Date();
        for (const [email, entry] of this.failedAttempts) {
          if (entry.lockedUntil && entry.lockedUntil < now) {
            this.failedAttempts.delete(email);
          }
        }
      },
      5 * 60 * 1000,
    );
    timer.unref();
  }

  private checkBruteForce(email: string): void {
    const entry = this.failedAttempts.get(email);
    if (entry?.lockedUntil && entry.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Please try again later.');
    }
  }

  private recordFailedAttempt(email: string): void {
    const entry = this.failedAttempts.get(email) || { count: 0 };
    entry.count++;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }
    this.failedAttempts.set(email, entry);
  }

  private clearFailedAttempts(email: string): void {
    this.failedAttempts.delete(email);
  }

  // C3 fix: No insecure fallback — fail hard if secrets are not configured
  private getRefreshSecret(): string {
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET');
    const jwtSecret = this.config.get<string>('JWT_SECRET');
    if (!refreshSecret && !jwtSecret)
      throw new Error('JWT_REFRESH_SECRET or JWT_SECRET must be configured');
    // M1 fix: In production, require a dedicated refresh secret — no fallback
    if (!refreshSecret && this.config.get('NODE_ENV') === 'production') {
      throw new Error(
        'JWT_REFRESH_SECRET must be set in production. Falling back to JWT_SECRET is not allowed.',
      );
    }
    // M3 fix: Warn if refresh and access tokens share the same signing key
    if (!refreshSecret && jwtSecret) {
      this.logger.warn(
        'JWT_REFRESH_SECRET not set — falling back to JWT_SECRET. Set a separate secret for production.',
      );
    }
    return refreshSecret || jwtSecret!;
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

    const slug =
      data.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Date.now().toString(36);

    const passwordHash = await bcrypt.hash(data.password, 12);

    const business = await this.prisma.business.create({
      data: { name: data.businessName, slug },
    });

    const staff = await this.prisma.staff.create({
      data: {
        businessId: business.id,
        name: data.ownerName,
        email: data.email,
        passwordHash,
        role: 'ADMIN',
        emailVerified: false,
      },
    });

    // M16 fix: Send email verification on signup
    await this.sendVerificationEmail(staff.id, staff.email, staff.name, staff.businessId);

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
    this.checkBruteForce(email);

    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!staff || !staff.isActive || !staff.passwordHash) {
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, staff.passwordHash);

    if (!valid) {
      this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.clearFailedAttempts(email);

    // H6 fix: Warn if staff's email is not verified (soft enforcement — don't block login)
    if (staff.emailVerified === false) {
      this.logger.warn(`Login by unverified email: staffId=${staff.id}, email=${staff.email}`);
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

  async getMe(
    staffId: string,
    viewAsClaims?: {
      viewAs: boolean;
      viewAsSessionId?: string;
      originalBusinessId?: string;
      originalRole?: string;
    },
  ) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { business: true },
    });
    if (!staff) throw new UnauthorizedException();

    // If in view-as mode, load the target business instead
    let business = staff.business;
    if (viewAsClaims?.viewAs && viewAsClaims.originalBusinessId) {
      const targetBusiness = await this.prisma.business.findUnique({
        where: { id: staff.businessId },
      });
      if (targetBusiness) business = targetBusiness;
    }

    const result: Record<string, any> = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: viewAsClaims?.viewAs ? 'ADMIN' : staff.role,
      locale: staff.locale,
      emailVerified: staff.emailVerified,
      preferences: (staff as any).preferences || {},
      businessId: viewAsClaims?.viewAs ? business.id : staff.businessId,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        verticalPack: business.verticalPack,
        defaultLocale: business.defaultLocale,
        packConfig: business.packConfig as Record<string, unknown> | null,
      },
    };

    if (viewAsClaims?.viewAs) {
      result.viewAs = true;
      result.viewAsSessionId = viewAsClaims.viewAsSessionId;
      result.originalRole = viewAsClaims.originalRole;
    }

    return result;
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
    // C1 fix: Atomically validate + consume token to prevent concurrent reuse
    const tokenRecord = await this.tokenService.validateAndConsume(token, 'PASSWORD_RESET');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.staff.update({
      where: { id: tokenRecord!.staffId! },
      data: { passwordHash },
    });

    return { ok: true };
  }

  async changePassword(staffId: string, currentPassword: string, newPassword: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || !staff.passwordHash) throw new BadRequestException('Cannot change password');

    const valid = await bcrypt.compare(currentPassword, staff.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { passwordHash },
    });

    // C4 fix: Revoke ALL stored tokens (password reset, invite, self-serve links)
    // Note: Full JWT revocation requires a blacklist system (tracked as H1)
    await this.tokenService.revokeAllTokensForEmail(staff.email);

    // Issue new tokens for the current session
    const tokens = this.issueTokens(staff);
    return { ok: true, ...tokens };
  }

  async acceptInvite(token: string, password: string) {
    // C2 fix: Atomically validate + consume token to prevent concurrent reuse
    const tokenRecord = await this.tokenService.validateAndConsume(token, 'STAFF_INVITE');

    const staff = await this.prisma.staff.findUnique({
      where: { id: tokenRecord!.staffId! },
    });

    if (!staff) throw new BadRequestException('Staff member not found');

    const passwordHash = await bcrypt.hash(password, 12);
    const updatedStaff = await this.prisma.staff.update({
      where: { id: staff.id },
      data: { passwordHash, isActive: true },
    });

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

  // M16 fix: Email verification flow
  async verifyEmail(token: string) {
    // C3 fix: Atomically validate + consume token to prevent concurrent reuse
    const tokenRecord = await this.tokenService.validateAndConsume(token, 'EMAIL_VERIFY');

    await this.prisma.staff.update({
      where: { id: tokenRecord!.staffId! },
      data: { emailVerified: true },
    });

    return { ok: true };
  }

  async resendVerification(staffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new BadRequestException('Staff not found');
    if (staff.emailVerified) throw new BadRequestException('Email already verified');

    // Revoke any existing verification tokens
    await this.tokenService.revokeTokens(staff.email, 'EMAIL_VERIFY');

    await this.sendVerificationEmail(staff.id, staff.email, staff.name, staff.businessId);

    return { ok: true };
  }

  private async sendVerificationEmail(
    staffId: string,
    email: string,
    name: string,
    businessId: string,
  ) {
    const token = await this.tokenService.createToken(
      'EMAIL_VERIFY',
      email,
      businessId,
      staffId,
      24, // 24 hour expiry
    );

    const verifyUrl = `${this.getWebUrl()}/verify-email?token=${token}`;
    await this.emailService.sendEmailVerification(email, { name, verifyUrl });
  }
}
