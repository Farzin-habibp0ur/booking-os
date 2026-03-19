import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';

@ApiTags('Messaging - Web Chat')
@Controller('messaging/web-chat')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class WebChatController {
  private readonly logger = new Logger(WebChatController.name);

  constructor(private prisma: PrismaService) {}

  /**
   * GET /messaging/web-chat/config — get current widget config for this business
   */
  @Get('config')
  async getConfig(@BusinessId() businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { channelSettings: true },
    });
    const settings = (business?.channelSettings as any) || {};
    return {
      primaryColor: settings.webChat?.primaryColor || '#71907C',
      title: settings.webChat?.title || 'Chat with us',
      subtitle:
        settings.webChat?.subtitle || 'We typically reply within minutes',
      placeholder: settings.webChat?.placeholder || 'Type a message...',
      position: settings.webChat?.position || 'bottom-right',
      preChatFields: settings.webChat?.preChatFields || ['name', 'email'],
      offlineMessage:
        settings.webChat?.offlineMessage ||
        'We are currently offline. Leave us a message!',
      showOfflineForm: settings.webChat?.showOfflineForm !== false,
    };
  }

  /**
   * PUT /messaging/web-chat/config — save widget config
   */
  @Put('config')
  async saveConfig(
    @BusinessId() businessId: string,
    @Body()
    body: {
      primaryColor?: string;
      title?: string;
      subtitle?: string;
      placeholder?: string;
      position?: string;
      preChatFields?: string[];
      offlineMessage?: string;
      showOfflineForm?: boolean;
    },
  ) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { channelSettings: true },
    });
    const currentSettings = (business?.channelSettings as any) || {};

    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        channelSettings: {
          ...currentSettings,
          webChat: { ...currentSettings.webChat, ...body },
        },
      },
    });

    this.logger.log(`Web chat config updated for business ${businessId}`);

    return { ok: true };
  }
}
