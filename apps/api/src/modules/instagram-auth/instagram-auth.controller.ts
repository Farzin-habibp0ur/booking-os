import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId } from '../../common/decorators';
import { InstagramAuthService } from './instagram-auth.service';
import { MessagingService } from '../messaging/messaging.service';

@ApiTags('Instagram Auth')
@Controller('instagram-auth')
export class InstagramAuthController {
  constructor(
    private instagramAuthService: InstagramAuthService,
    private configService: ConfigService,
    private messagingService: MessagingService,
  ) {}

  private getRedirectUri(): string {
    const apiUrl = this.configService.get<string>('API_URL', 'http://localhost:3001');
    return `${apiUrl}/api/v1/instagram-auth/callback`;
  }

  @Get('authorize')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  authorize(
    @BusinessId() businessId: string,
    @Query('locationId') locationId: string,
    @Res() res: Response,
  ) {
    if (!locationId) throw new BadRequestException('locationId is required');
    const url = this.instagramAuthService.getAuthorizeUrl(this.getRedirectUri());
    const state = Buffer.from(JSON.stringify({ businessId, locationId })).toString('base64');
    res.redirect(`${url}&state=${state}`);
  }

  /**
   * OAuth callback — NO auth guard. Meta redirects here after user authorizes.
   * BusinessId and locationId are passed via the `state` parameter.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code) throw new BadRequestException('Authorization code missing');
    if (!state) throw new BadRequestException('State parameter missing');

    const { businessId, locationId } = JSON.parse(
      Buffer.from(state, 'base64').toString('utf8'),
    );

    await this.instagramAuthService.handleCallback(
      businessId,
      locationId,
      code,
      this.getRedirectUri(),
    );

    const webUrl = this.configService.get<string>(
      'NEXT_PUBLIC_APP_URL',
      'http://localhost:3000',
    );
    res.redirect(`${webUrl}/settings/integrations?instagram=connected`);
  }

  @Delete(':locationId/disconnect')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  async disconnect(
    @BusinessId() businessId: string,
    @Param('locationId') locationId: string,
  ) {
    await this.instagramAuthService.disconnect(businessId, locationId);
    return { ok: true };
  }

  @Get(':locationId/status')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  async status(
    @BusinessId() businessId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.instagramAuthService.getStatus(businessId, locationId);
  }

  @Post(':locationId/ice-breakers')
  @UseGuards(AuthGuard('jwt'), TenantGuard)
  async setIceBreakers(
    @BusinessId() businessId: string,
    @Param('locationId') locationId: string,
    @Body() body: { prompts: Array<{ question: string; payload: string }> },
  ) {
    if (!body.prompts?.length) {
      throw new BadRequestException('At least one prompt is required');
    }
    if (body.prompts.length > 4) {
      throw new BadRequestException('Maximum 4 ice breaker prompts allowed');
    }

    const status = await this.instagramAuthService.getStatus(businessId, locationId);
    if (!status.connected) {
      throw new BadRequestException('Instagram is not connected for this location');
    }

    const location = await this.instagramAuthService.getLocationConfig(businessId, locationId);
    if (!location) {
      throw new BadRequestException('Instagram config not found');
    }

    const provider = this.messagingService.getProviderForLocationInstagramConfig(location);
    if (!provider) {
      throw new BadRequestException('Instagram provider not available');
    }

    await provider.setIceBreakers(body.prompts);
    return { ok: true };
  }
}
