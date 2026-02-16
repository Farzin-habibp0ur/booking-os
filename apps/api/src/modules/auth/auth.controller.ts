import { Controller, Post, Get, Body, Res, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../common/decorators';
import {
  SignupDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AcceptInviteDto,
} from '../../common/dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  private isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  private setTokenCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    const secure = this.isProduction();
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/auth',
    });
  }

  private clearTokenCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }

  @Post('signup')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async signup(@Body() body: SignupDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.signup(body);
    this.setTokenCookies(res, result);
    return result;
  }

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);
    this.setTokenCookies(res, result);
    return result;
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Support cookie-based refresh (preferred) or body-based (legacy)
    const token = (req.cookies?.refresh_token as string) || body.refreshToken;
    if (!token) {
      return { message: 'No refresh token provided' };
    }
    const result = await this.authService.refresh(token);
    this.setTokenCookies(res, result);
    return result;
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  logout(@Res({ passthrough: true }) res: Response) {
    this.clearTokenCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@CurrentUser('sub') staffId: string) {
    return this.authService.getMe(staffId);
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
  changePassword(@CurrentUser('sub') staffId: string, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(staffId, body.currentPassword, body.newPassword);
  }

  @Post('accept-invite')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async acceptInvite(@Body() body: AcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.acceptInvite(body.token, body.password);
    this.setTokenCookies(res, result);
    return result;
  }
}
