import { Controller, Get, Param, NotFoundException, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma.service';

@ApiTags('Public Chat')
@Controller('public/chat')
export class PublicChatController {
  private readonly logger = new Logger(PublicChatController.name);

  constructor(private prisma: PrismaService) {}

  @Get('config/:businessSlug')
  async getChatConfig(@Param('businessSlug') businessSlug: string) {
    const business = await this.prisma.business.findFirst({
      where: { slug: businessSlug },
      select: {
        id: true,
        name: true,
        channelSettings: true,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const channelSettings = (business.channelSettings as any) || {};
    const webChat = channelSettings.webChat || {};

    return {
      businessName: business.name,
      greeting: webChat.greeting || `Welcome to ${business.name}! How can we help you?`,
      theme: webChat.theme || { primaryColor: '#71907C' },
      preChatFields: webChat.preChatFields || ['name', 'email'],
      offlineMessage:
        webChat.offlineMessage ||
        "We're currently offline. Leave a message and we'll get back to you.",
      online: true, // Simplified — in production, check staff online status
    };
  }
}
