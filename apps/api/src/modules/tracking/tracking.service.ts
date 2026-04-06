import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private prisma: PrismaService) {}

  generateTrackingUrl(campaignSendId: string, originalUrl: string, baseUrl: string): string {
    const trackingId = Buffer.from(JSON.stringify({ s: campaignSendId, u: originalUrl })).toString(
      'base64url',
    );
    return `${baseUrl}/api/v1/t/${trackingId}`;
  }

  async recordClick(trackingId: string, userAgent?: string): Promise<{ url: string }> {
    const decoded = JSON.parse(Buffer.from(trackingId, 'base64url').toString('utf-8')) as {
      s: string;
      u: string;
    };

    await this.prisma.campaignClick.create({
      data: {
        campaignSendId: decoded.s,
        url: decoded.u,
        userAgent: userAgent || null,
      },
    });

    return { url: decoded.u };
  }

  async recordOpen(pixelId: string): Promise<void> {
    const campaignSendId = Buffer.from(pixelId, 'base64url').toString('utf-8');

    await this.prisma.campaignSend.updateMany({
      where: { id: campaignSendId, openedAt: null },
      data: { openedAt: new Date() },
    });
  }

  generateTrackingPixel(campaignSendId: string, baseUrl: string): string {
    const pixelId = Buffer.from(campaignSendId).toString('base64url');
    return `<img src="${baseUrl}/api/v1/t/o/${pixelId}" width="1" height="1" style="display:none" />`;
  }

  wrapUrlsInContent(content: string, campaignSendId: string, baseUrl: string): string {
    return content.replace(/https?:\/\/[^\s<>"']+/g, (url) =>
      this.generateTrackingUrl(campaignSendId, url, baseUrl),
    );
  }
}
