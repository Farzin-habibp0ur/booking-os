import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarProvider, CalendarEvent } from './calendar.provider.interface';

@Injectable()
export class OutlookCalendarProvider implements CalendarProvider {
  private readonly logger = new Logger(OutlookCalendarProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private config: ConfigService) {
    this.clientId = this.config.get<string>('MICROSOFT_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('MICROSOFT_CLIENT_SECRET', '');
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'Calendars.ReadWrite offline_access',
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Outlook token exchange failed: ${err}`);
      throw new Error('Failed to exchange Outlook auth code');
    }

    const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        scope: 'Calendars.ReadWrite offline_access',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Outlook token refresh failed: ${err}`);
      throw new Error('Failed to refresh Outlook token');
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async createEvent(accessToken: string, _calendarId: string, event: CalendarEvent): Promise<string> {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: event.summary,
        body: { contentType: 'text', content: event.description || '' },
        start: { dateTime: event.startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: event.endTime.toISOString(), timeZone: 'UTC' },
        location: event.location ? { displayName: event.location } : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Outlook create event failed: ${err}`);
      throw new Error('Failed to create Outlook Calendar event');
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async updateEvent(accessToken: string, _calendarId: string, eventId: string, event: CalendarEvent): Promise<void> {
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: event.summary,
        body: { contentType: 'text', content: event.description || '' },
        start: { dateTime: event.startTime.toISOString(), timeZone: 'UTC' },
        end: { dateTime: event.endTime.toISOString(), timeZone: 'UTC' },
        location: event.location ? { displayName: event.location } : undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Outlook update event failed: ${err}`);
      throw new Error('Failed to update Outlook Calendar event');
    }
  }

  async deleteEvent(accessToken: string, _calendarId: string, eventId: string): Promise<void> {
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok && res.status !== 404) {
      const err = await res.text();
      this.logger.error(`Outlook delete event failed: ${err}`);
      throw new Error('Failed to delete Outlook Calendar event');
    }
  }
}
