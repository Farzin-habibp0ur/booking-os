import { Controller, Post, Get, Param, Body, UseGuards, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { CurrentUser } from '../../common/decorators';
import { ConsoleViewAsService } from './console-view-as.service';
import { ViewAsReasonDto } from '../../common/dto';

@ApiTags('Console - View As')
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ConsoleViewAsController {
  constructor(
    private viewAsService: ConsoleViewAsService,
    private config: ConfigService,
  ) {}

  private isProduction(): boolean {
    return this.config.get('NODE_ENV') === 'production';
  }

  private getCookieDomain(): string | undefined {
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
      // Ignore
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
      maxAge: 15 * 60 * 1000,
      path: '/',
      ...(domain && { domain }),
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
      ...(domain && { domain }),
    });
  }

  @Post('businesses/:id/view-as')
  @Roles('SUPER_ADMIN')
  async startViewAs(
    @Param('id') targetBusinessId: string,
    @Body() body: ViewAsReasonDto,
    @CurrentUser() user: { sub: string; email: string; businessId: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.viewAsService.startSession(
      user.sub,
      user.email,
      user.businessId,
      targetBusinessId,
      body.reason,
    );

    this.setTokenCookies(res, result);

    return result;
  }

  // No @Roles — must work during view-as (role=ADMIN with viewAs claim)
  @Post('view-as/end')
  async endViewAs(
    @CurrentUser() user: {
      sub: string;
      email: string;
      viewAsSessionId?: string;
      originalRole?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.viewAsService.endSession(
      user.sub,
      user.email,
      user.viewAsSessionId,
    );

    if (result.accessToken && result.refreshToken) {
      this.setTokenCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    }

    return result;
  }

  // No @Roles — must work during view-as
  @Get('view-as/active')
  async getActiveSession(
    @CurrentUser() user: { sub: string },
  ) {
    return this.viewAsService.getActiveSession(user.sub);
  }
}
