import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { CalendarSyncService } from './calendar-sync.service';
import { CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@ApiTags('Calendar Sync')
@Controller('calendar-sync')
export class CalendarSyncController {
  constructor(private calendarSyncService: CalendarSyncService) {}

  @Get('connections')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  getConnections(@CurrentUser('staffId') staffId: string) {
    return this.calendarSyncService.getConnections(staffId);
  }

  @Get('providers')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  getProviders() {
    return this.calendarSyncService.getAvailableProviders();
  }

  @Post('connect/:provider')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  async connect(@CurrentUser('staffId') staffId: string, @Param('provider') provider: string) {
    if (!['google', 'outlook'].includes(provider)) {
      throw new BadRequestException('Invalid provider');
    }
    const url = await this.calendarSyncService.initiateOAuth(staffId, provider);
    return { url };
  }

  @Get('callback/:provider')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state');
    }
    const redirectUrl = await this.calendarSyncService.handleOAuthCallback(provider, code, state);
    res.redirect(redirectUrl);
  }

  @Delete('connections/:provider')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  async disconnect(@CurrentUser('staffId') staffId: string, @Param('provider') provider: string) {
    await this.calendarSyncService.disconnect(staffId, provider);
    return { success: true };
  }

  @Get('ical-feed-url')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  async getIcalFeedUrl(@CurrentUser('staffId') staffId: string) {
    const url = await this.calendarSyncService.getIcalFeedUrl(staffId);
    return { url };
  }

  @Post('regenerate-ical-token')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  async regenerateIcalToken(@CurrentUser('staffId') staffId: string) {
    const url = await this.calendarSyncService.regenerateIcalToken(staffId);
    return { url };
  }
}
