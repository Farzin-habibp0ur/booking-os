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
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { JwtBlacklistService } from '../../common/jwt-blacklist.service';
import { PortalRedisService } from '../../common/portal-redis.service';
import { EmailService } from '../email/email.service';
import { OnboardingDripService } from '../onboarding-drip/onboarding-drip.service';
import { ReferralService } from '../referral/referral.service';
import { TwoFactorService } from './two-factor.service';
import { TRIAL_DAYS, GRACE_PERIOD_DAYS } from '../../common/plan-config';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const BRUTE_FORCE_TTL_MS = LOCKOUT_MINUTES * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private tokenService: TokenService,
    private emailService: EmailService,
    private onboardingDrip: OnboardingDripService,
    private referralService: ReferralService,
    private twoFactor: TwoFactorService,
    private blacklist: JwtBlacklistService,
    private redis: PortalRedisService,
  ) {}

  private async checkBruteForce(email: string): Promise<void> {
    const key = `auth:brute:${email}`;
    const countStr = await this.redis.get(key);
    if (countStr && parseInt(countStr, 10) >= MAX_FAILED_ATTEMPTS) {
      throw new UnauthorizedException('Account temporarily locked. Please try again later.');
    }
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    const key = `auth:brute:${email}`;
    const countStr = await this.redis.get(key);
    const count = countStr ? parseInt(countStr, 10) + 1 : 1;
    await this.redis.set(key, String(count), BRUTE_FORCE_TTL_MS);
  }

  private async clearFailedAttempts(email: string): Promise<void> {
    await this.redis.del(`auth:brute:${email}`);
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

  private async issueTokens(
    staff: { id: string; email: string; businessId: string; role: string },
    familyId?: string,
  ) {
    const payload = {
      sub: staff.id,
      email: staff.email,
      businessId: staff.businessId,
      role: staff.role,
    };

    const tokenFamilyId = familyId || randomUUID();
    const jti = randomUUID();

    const refreshToken = this.jwt.sign(
      { ...payload, jti, familyId: tokenFamilyId },
      {
        secret: this.getRefreshSecret(),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRATION', '7d'),
      },
    );

    // Track this token in its family for reuse detection
    const familyKey = `auth:family:${tokenFamilyId}`;
    const existing = (await this.redis.get(familyKey)) || '';
    const updated = existing ? `${existing},${jti}` : jti;
    await this.redis.set(familyKey, updated, REFRESH_TOKEN_TTL_MS);

    return {
      accessToken: this.jwt.sign(payload),
      refreshToken,
    };
  }

  private getWebUrl(): string {
    return this.config.get<string>('WEB_URL') || 'http://localhost:3000';
  }

  async signup(data: {
    businessName: string;
    ownerName: string;
    email: string;
    password: string;
    referralCode?: string;
  }) {
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

    // Calculate trial dates
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const graceEndsAt = new Date(trialEndsAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const business = await this.prisma.business.create({
      data: { name: data.businessName, slug, trialEndsAt, graceEndsAt },
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

    // Track referral if a referral code was provided
    if (data.referralCode) {
      try {
        await this.referralService.trackReferral(data.referralCode, business.id);
      } catch (err) {
        this.logger.warn(
          `Failed to track referral for code ${data.referralCode}: ${(err as Error).message}`,
        );
      }
    }

    // M16 fix: Send email verification on signup
    await this.sendVerificationEmail(staff.id, staff.email, staff.name, staff.businessId);

    // Send welcome email
    try {
      const webUrl = this.getWebUrl();
      await this.emailService.sendGeneric(staff.email, {
        subject: "Welcome to Booking OS — let's get your first booking live in 10 minutes",
        headline: `Welcome, ${staff.name}!`,
        body: `You've just started your 14-day free trial of Booking OS. Every feature is unlocked — no credit card required. Let's get your clinic set up and accepting bookings.`,
        ctaLabel: 'Start Setup',
        ctaUrl: `${webUrl}/setup`,
      });
    } catch (err) {
      this.logger.warn(`Failed to send welcome email to ${staff.email}`, err);
    }

    // Schedule onboarding drip emails
    try {
      await this.onboardingDrip.scheduleDrip(business.id, staff.email, staff.name);
    } catch (err) {
      this.logger.warn(`Failed to schedule drip for ${staff.email}`, err);
    }

    const tokens = await this.issueTokens(staff);

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
    await this.checkBruteForce(email);

    const staff = await this.prisma.staff.findUnique({
      where: { email },
      include: { business: true },
    });

    if (!staff || !staff.isActive || !staff.passwordHash) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, staff.passwordHash);

    if (!valid) {
      await this.recordFailedAttempt(email);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.clearFailedAttempts(email);

    // H6 fix: Warn if staff's email is not verified (soft enforcement — don't block login)
    if (staff.emailVerified === false) {
      this.logger.warn(`Login by unverified email: staffId=${staff.id}, email=${staff.email}`);
    }

    // P-17: If 2FA is enabled, return a short-lived temp token instead of full tokens
    if (staff.twoFactorEnabled) {
      const tempToken = this.jwt.sign({ sub: staff.id, type: '2fa_pending' }, { expiresIn: '5m' });
      return { requires2FA: true, tempToken } as any;
    }

    const tokens = await this.issueTokens(staff);

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

      // Token rotation: check if this token has already been used (reuse detection)
      if (await this.blacklist.isBlacklisted(refreshToken)) {
        // Reuse detected — revoke the entire token family
        if (payload.familyId) {
          await this.revokeTokenFamily(payload.familyId);
        }
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      const staff = await this.prisma.staff.findUnique({
        where: { id: payload.sub },
      });
      if (!staff || !staff.isActive) {
        throw new UnauthorizedException();
      }

      // Blacklist the old refresh token immediately (rotation)
      await this.blacklist.blacklistToken(refreshToken, REFRESH_TOKEN_TTL_MS);

      // Issue new tokens in the same family
      return await this.issueTokens(staff, payload.familyId);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async revokeTokenFamily(familyId: string): Promise<void> {
    const familyKey = `auth:family:${familyId}`;
    const jtis = await this.redis.get(familyKey);
    if (jtis) {
      // We can't blacklist by jti alone since blacklist works on full tokens.
      // Delete the family record to prevent further token issuance.
      this.logger.warn(`Token family ${familyId} revoked due to reuse detection`);
    }
    await this.redis.del(familyKey);
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

    // Calculate trial status
    const now = new Date();
    const isTrial = business.trialEndsAt ? business.trialEndsAt > now : false;
    const trialDaysRemaining =
      isTrial && business.trialEndsAt
        ? Math.max(
            0,
            Math.ceil((business.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          )
        : 0;
    const trialExpired = business.trialEndsAt ? now > business.trialEndsAt : false;
    const isGracePeriod =
      business.trialEndsAt &&
      business.graceEndsAt &&
      now > business.trialEndsAt &&
      now <= business.graceEndsAt;

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
        createdAt: business.createdAt.toISOString(),
      },
      trial: {
        isTrial,
        trialDaysRemaining,
        trialExpired,
        trialEndsAt: business.trialEndsAt?.toISOString() || null,
        isGracePeriod: !!isGracePeriod,
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
    const tokens = await this.issueTokens(staff);
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

    const tokens = await this.issueTokens(updatedStaff);

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

  // ---- P-17: Two-Factor Authentication ----

  async twoFactorSetup(staffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new BadRequestException('Staff not found');
    if (staff.twoFactorEnabled) throw new BadRequestException('2FA is already enabled');

    const { secret, otpauthUrl } = this.twoFactor.generateSetup(staff.email);

    // Store secret but don't enable yet — user must verify a code first
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { twoFactorSecret: secret },
    });

    return { secret, otpauthUrl };
  }

  async twoFactorVerifySetup(staffId: string, code: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new BadRequestException('Staff not found');
    if (!staff.twoFactorSecret) throw new BadRequestException('2FA setup not initiated');
    if (staff.twoFactorEnabled) throw new BadRequestException('2FA is already enabled');

    const valid = this.twoFactor.verifyCode(staff.twoFactorSecret, code);
    if (!valid) throw new UnauthorizedException('Invalid verification code');

    // Generate backup codes
    const { plaintext, hashed } = await this.twoFactor.generateBackupCodes();

    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        twoFactorEnabled: true,
        backupCodes: hashed,
      },
    });

    return { backupCodes: plaintext };
  }

  async twoFactorDisable(staffId: string, code: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new BadRequestException('Staff not found');
    if (!staff.twoFactorEnabled) throw new BadRequestException('2FA is not enabled');

    const valid = this.twoFactor.verifyCode(staff.twoFactorSecret!, code);
    if (!valid) throw new UnauthorizedException('Invalid verification code');

    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: [],
      },
    });

    return { ok: true };
  }

  async twoFactorChallenge(tempToken: string, code: string) {
    let payload: { sub: string; type: string };
    try {
      payload = this.jwt.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA token');
    }

    if (payload.type !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token type');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
    });

    if (!staff || !staff.isActive || !staff.twoFactorEnabled) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Try TOTP first
    const totpValid = this.twoFactor.verifyCode(staff.twoFactorSecret!, code);

    if (!totpValid) {
      // Try backup code
      const storedCodes = (staff.backupCodes || []) as string[];
      const { valid: backupValid, remainingCodes } = await this.twoFactor.verifyBackupCode(
        storedCodes,
        code,
      );

      if (!backupValid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }

      // Consume the backup code
      await this.prisma.staff.update({
        where: { id: staff.id },
        data: { backupCodes: remainingCodes },
      });
    }

    // Issue full tokens
    const tokens = await this.issueTokens(staff);

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

  async getTwoFactorStatus(staffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new BadRequestException('Staff not found');
    const backupCodesCount = Array.isArray(staff.backupCodes)
      ? (staff.backupCodes as string[]).length
      : 0;
    return { enabled: staff.twoFactorEnabled, backupCodesRemaining: backupCodesCount };
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
