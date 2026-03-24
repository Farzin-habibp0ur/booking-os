import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceTokenService } from '../device-token/device-token.service';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly fcmProjectId: string | undefined;
  private readonly fcmServiceAccountKey: string | undefined;

  constructor(
    private config: ConfigService,
    private deviceTokenService: DeviceTokenService,
  ) {
    this.fcmProjectId = this.config.get<string>('FCM_PROJECT_ID');
    this.fcmServiceAccountKey = this.config.get<string>('FCM_SERVICE_ACCOUNT_KEY');

    if (!this.fcmProjectId || !this.fcmServiceAccountKey) {
      this.logger.warn(
        'FCM_PROJECT_ID or FCM_SERVICE_ACCOUNT_KEY not set — push notifications will be logged only',
      );
    }
  }

  private get isConfigured(): boolean {
    return !!(this.fcmProjectId && this.fcmServiceAccountKey);
  }

  async sendToStaff(staffId: string, notification: PushPayload): Promise<void> {
    const tokens = await this.deviceTokenService.findActiveByStaff(staffId);

    if (tokens.length === 0) {
      this.logger.debug(`No active device tokens for staff ${staffId}`);
      return;
    }

    for (const deviceToken of tokens) {
      await this.sendToToken(deviceToken.token, notification);
    }
  }

  async sendToBusiness(businessId: string, notification: PushPayload): Promise<void> {
    const tokens = await this.deviceTokenService.findActiveByBusiness(businessId);

    if (tokens.length === 0) {
      this.logger.debug(`No active device tokens for business ${businessId}`);
      return;
    }

    for (const deviceToken of tokens) {
      await this.sendToToken(deviceToken.token, notification);
    }
  }

  private async sendToToken(token: string, notification: PushPayload): Promise<void> {
    if (!this.isConfigured) {
      this.logger.log(
        `[Push - dry run] To: ${token.substring(0, 10)}... | Title: ${notification.title} | Body: ${notification.body}`,
      );
      return;
    }

    try {
      const accessToken = await this.getAccessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${this.fcmProjectId}/messages:send`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: notification.title,
              body: notification.body,
            },
            data: notification.data || {},
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`FCM send failed for token ${token.substring(0, 10)}...: ${error}`);

        // Deactivate invalid tokens
        if (response.status === 404 || response.status === 410) {
          await this.deviceTokenService.unregister(token);
          this.logger.log(`Deactivated invalid token: ${token.substring(0, 10)}...`);
        }
      }
    } catch (err) {
      this.logger.error(
        `Push notification failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private cachedToken: { token: string; expiresAt: number } | null = null;

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 60000) {
      return this.cachedToken.token;
    }

    const crypto = await import('crypto');
    const serviceAccount = JSON.parse(this.fcmServiceAccountKey!);

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');

    const signature = crypto
      .createSign('RSA-SHA256')
      .update(`${header}.${payload}`)
      .sign(serviceAccount.private_key, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
      throw new Error(`Failed to get FCM access token: ${await response.text()}`);
    }

    const data = await response.json();
    this.cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }
}
