import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';

@ApiTags('Messaging - Channel Status')
@Controller('messaging/channels')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class ChannelStatusController {
  private readonly logger = new Logger(ChannelStatusController.name);

  constructor(private prisma: PrismaService) {}

  /**
   * GET /messaging/channels/status — returns which channels are configured for this business
   */
  @Get('status')
  async getChannelStatus(@BusinessId() businessId: string) {
    const locations = await this.prisma.location.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        name: true,
        whatsappConfig: true,
        instagramConfig: true,
        facebookConfig: true,
        smsConfig: true,
        emailConfig: true,
        webChatConfig: true,
      },
    });

    const channels = {
      WHATSAPP: locations.some((l) => !!(l.whatsappConfig as any)?.phoneNumberId),
      INSTAGRAM: locations.some((l) => !!(l.instagramConfig as any)?.pageId),
      FACEBOOK: locations.some((l) => !!(l.facebookConfig as any)?.pageId),
      SMS: locations.some((l) => !!(l.smsConfig as any)?.phoneNumber),
      EMAIL: locations.some((l) => !!(l.emailConfig as any)?.inboundAddress),
      WEB_CHAT: locations.some((l) => !!(l.webChatConfig as any)?.enabled),
    };

    this.logger.debug(`Channel status for business ${businessId}: ${JSON.stringify(channels)}`);

    return { channels, locationCount: locations.length };
  }
}
