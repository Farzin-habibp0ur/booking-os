import { Controller, Post, Get, Body, Res, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtBlacklistService } from '../../common/jwt-blacklist.service';
import { CurrentUser } from '../../common/decorators';
import {
  LoginDto,
  SignupDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AcceptInviteDto,
  VerifyEmailDto,
} from '../../common/dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
    private blacklist: JwtBlacklistService,
  ) {}

  private isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  private getCookieDomain(): string | undefined {
    // Share cookies across subdomains (api.X.com ↔ X.com) in production
    if (!this.isProduction()) return undefined;
    const origins = this.config.get('CORS_ORIGINS') || '';
    const firstOrigin = origins.split(',')[0];
    try {
      const hostname = new URL(firstOrigin).hostname;
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return '.' + parts.slice(-2).join('.');
      }
    } catch {
      // Ignore — no domain set
    }
    return undefined;
  }

  private setTokenCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const secure = this.isProduction();
    const domain = this.getCookieDomain();
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      ...(domain && { domain }),
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
      ...(domain && { domain }),
    });
  }

  private clearTokenCookies(res: Response) {
    const domain = this.getCookieDomain();
    res.clearCookie('access_token', { path: '/', ...(domain && { domain }) });
    res.clearCookie('refresh_token', { path: '/', ...(domain && { domain }) });
  }

  @Post('signup')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async signup(@Body() body: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(body);
    this.setTokenCookies(res, result);
    return result;
  }

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body.email, body.password);
    this.setTokenCookies(res, result);
    return result;
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // H3 fix: Only accept refresh token from httpOnly cookie — not from request body
    const token = req.cookies?.refresh_token as string;
    if (!token) {
      return { message: 'No refresh token provided' };
    }
    // H5 fix: Reject blacklisted refresh tokens
    if (this.blacklist.isBlacklisted(token)) {
      this.clearTokenCookies(res);
      return { message: 'Refresh token has been revoked' };
    }
    const result = await this.authService.refresh(token);
    this.setTokenCookies(res, result);
    return result;
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // H1 fix: Blacklist current access token so it can't be reused
    const token = req.cookies?.access_token as string;
    if (token) {
      this.blacklist.blacklistToken(token);
    }
    // H5 fix: Also blacklist refresh token on logout (7-day TTL to match cookie maxAge)
    const refreshToken = req.cookies?.refresh_token as string;
    if (refreshToken) {
      this.blacklist.blacklistToken(refreshToken, 7 * 24 * 60 * 60 * 1000);
    }
    this.clearTokenCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(
    @CurrentUser() user: { sub: string; viewAs?: boolean; viewAsSessionId?: string; originalBusinessId?: string; originalRole?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set('Cache-Control', 'no-store');
    res.removeHeader('ETag');
    const viewAsClaims = user.viewAs
      ? { viewAs: true, viewAsSessionId: user.viewAsSessionId, originalBusinessId: user.originalBusinessId, originalRole: user.originalRole }
      : undefined;
    return this.authService.getMe(user.sub, viewAsClaims);
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(
    @Req() req: Request,
    @CurrentUser('sub') staffId: string,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(
      staffId,
      body.currentPassword,
      body.newPassword,
    );
    // H1 fix: Blacklist old access token after password change
    const oldToken = req.cookies?.access_token as string;
    if (oldToken) {
      this.blacklist.blacklistToken(oldToken);
    }
    // H5 fix: Also blacklist old refresh token
    const oldRefresh = req.cookies?.refresh_token as string;
    if (oldRefresh) {
      this.blacklist.blacklistToken(oldRefresh, 7 * 24 * 60 * 60 * 1000);
    }
    // Set new token cookies
    if (result.accessToken && result.refreshToken) {
      this.setTokenCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }
    return result;
  }

  @Post('accept-invite')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async acceptInvite(@Body() body: AcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.acceptInvite(body.token, body.password);
    this.setTokenCookies(res, result);
    return result;
  }

  // M16: Public endpoint — verify email with token
  @Post('verify-email')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.token);
  }

  // M16: Authenticated endpoint — resend verification email
  @Post('resend-verification')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  resendVerification(@CurrentUser('sub') staffId: string) {
    return this.authService.resendVerification(staffId);
  }
}
