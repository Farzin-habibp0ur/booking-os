import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { Prisma } from '@booking-os/db';

interface InstagramConfig {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramBusinessAccountId: string;
  connectedAt: string;
  tokenExpiresAt: string;
}

@Injectable()
export class InstagramAuthService {
  private readonly logger = new Logger(InstagramAuthService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  getAuthorizeUrl(redirectUri: string): string {
    const appId = this.configService.get<string>('INSTAGRAM_APP_ID');
    if (!appId) throw new BadRequestException('Instagram app not configured');

    const scopes = [
      'instagram_basic',
      'instagram_manage_messages',
      'pages_manage_metadata',
      'pages_show_list',
    ].join(',');

    return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
  }

  async handleCallback(
    businessId: string,
    locationId: string,
    code: string,
    redirectUri: string,
  ): Promise<{ pageName: string; pageId: string }> {
    const appId = this.configService.get<string>('INSTAGRAM_APP_ID');
    const appSecret = this.configService.get<string>('INSTAGRAM_APP_SECRET');
    if (!appId || !appSecret) throw new BadRequestException('Instagram app not configured');

    // Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`,
    );
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      this.logger.error(`Token exchange failed: ${err}`);
      throw new BadRequestException('Failed to exchange authorization code');
    }
    const tokenData = (await tokenRes.json()) as { access_token: string };
    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`,
    );
    if (!longLivedRes.ok) {
      throw new BadRequestException('Failed to get long-lived token');
    }
    const longLivedData = (await longLivedRes.json()) as {
      access_token: string;
      expires_in?: number;
    };
    const longLivedToken = longLivedData.access_token;
    const expires_in = longLivedData.expires_in;

    // Get pages and find one with Instagram business account
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}&fields=id,name,access_token,instagram_business_account`,
    );
    if (!pagesRes.ok) throw new BadRequestException('Failed to fetch pages');
    const pagesData = (await pagesRes.json()) as { data: any[] };
    const pages = pagesData.data;

    const page = pages?.find((p: any) => p.instagram_business_account?.id);
    if (!page) {
      throw new BadRequestException(
        'No Facebook Page with an Instagram Business Account found. Please connect an Instagram Professional account to your Facebook Page first.',
      );
    }

    const config: InstagramConfig = {
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
      instagramBusinessAccountId: page.instagram_business_account.id,
      connectedAt: new Date().toISOString(),
      tokenExpiresAt: new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString(),
    };

    await this.prisma.location.update({
      where: { id: locationId },
      data: { instagramConfig: config as unknown as Prisma.InputJsonValue },
    });

    this.logger.log(
      `Instagram connected for location ${locationId}: page "${page.name}" (${page.id})`,
    );

    return { pageName: page.name, pageId: page.id };
  }

  async disconnect(businessId: string, locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, businessId },
    });
    if (!location) throw new BadRequestException('Location not found');

    await this.prisma.location.update({
      where: { id: locationId },
      data: { instagramConfig: Prisma.DbNull },
    });

    this.logger.log(`Instagram disconnected for location ${locationId}`);
  }

  async getStatus(
    businessId: string,
    locationId: string,
  ): Promise<{
    connected: boolean;
    pageName?: string;
    pageId?: string;
    tokenExpiresAt?: string;
  }> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, businessId },
    });
    if (!location) throw new BadRequestException('Location not found');

    const config = location.instagramConfig as unknown as InstagramConfig | null;
    if (!config?.pageId) {
      return { connected: false };
    }

    return {
      connected: true,
      pageName: config.pageName,
      pageId: config.pageId,
      tokenExpiresAt: config.tokenExpiresAt,
    };
  }

  async getLocationConfig(
    businessId: string,
    locationId: string,
  ): Promise<Record<string, any> | null> {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, businessId },
    });
    return (location?.instagramConfig as Record<string, any>) || null;
  }

  /**
   * Refresh long-lived tokens that are expiring within 10 days.
   * Facebook long-lived tokens last 60 days; refresh at 50-day mark.
   * Runs daily at 3 AM.
   */
  @Cron('0 3 * * *')
  async refreshExpiringTokens(): Promise<void> {
    const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const locations = await this.prisma.location.findMany({
      where: {
        isActive: true,
        instagramConfig: { not: Prisma.DbNull },
      },
    });

    for (const location of locations) {
      const config = location.instagramConfig as unknown as InstagramConfig | null;
      if (!config?.pageAccessToken || !config.tokenExpiresAt) continue;

      const expiresAt = new Date(config.tokenExpiresAt);
      if (expiresAt > tenDaysFromNow) continue;

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${this.configService.get('INSTAGRAM_APP_ID')}&client_secret=${this.configService.get('INSTAGRAM_APP_SECRET')}&fb_exchange_token=${config.pageAccessToken}`,
        );

        if (!res.ok) {
          this.logger.error(
            `Failed to refresh Instagram token for location ${location.id}: ${await res.text()}`,
          );
          continue;
        }

        const refreshData = (await res.json()) as { access_token: string; expires_in?: number };
        const { access_token, expires_in } = refreshData;

        const updatedConfig: InstagramConfig = {
          ...config,
          pageAccessToken: access_token,
          tokenExpiresAt: new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString(),
        };

        await this.prisma.location.update({
          where: { id: location.id },
          data: { instagramConfig: updatedConfig as unknown as Prisma.InputJsonValue },
        });

        this.logger.log(`Refreshed Instagram token for location ${location.id}`);
      } catch (err: any) {
        this.logger.error(
          `Error refreshing Instagram token for location ${location.id}: ${err.message}`,
        );
      }
    }
  }
}
