import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarProvider, CalendarEvent } from './calendar.provider.interface';

@Injectable()
export class GoogleCalendarProvider implements CalendarProvider {
  private readonly logger = new Logger(GoogleCalendarProvider.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private config: ConfigService) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET', '');
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
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
      this.logger.error(`Google token exchange failed: ${err}`);
      throw new Error('Failed to exchange Google auth code');
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Google token refresh failed: ${err}`);
      throw new Error('Failed to refresh Google token');
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: CalendarEvent,
  ): Promise<string> {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.startTime.toISOString() },
          end: { dateTime: event.endTime.toISOString() },
          location: event.location,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Google create event failed: ${err}`);
      throw new Error('Failed to create Google Calendar event');
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: CalendarEvent,
  ): Promise<void> {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: { dateTime: event.startTime.toISOString() },
          end: { dateTime: event.endTime.toISOString() },
          location: event.location,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Google update event failed: ${err}`);
      throw new Error('Failed to update Google Calendar event');
    }
  }

  async listEvents(
    accessToken: string,
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Google list events failed: ${err}`);
      throw new Error('Failed to list Google Calendar events');
    }

    const data = (await res.json()) as {
      items: Array<{
        summary?: string;
        description?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        location?: string;
        status?: string;
      }>;
    };

    return (data.items || [])
      .filter((item) => item.status !== 'cancelled')
      .filter((item) => item.start?.dateTime && item.end?.dateTime)
      .map((item) => ({
        summary: item.summary || '',
        description: item.description,
        startTime: new Date(item.start!.dateTime!),
        endTime: new Date(item.end!.dateTime!),
        location: item.location,
      }));
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!res.ok && res.status !== 410) {
      const err = await res.text();
      this.logger.error(`Google delete event failed: ${err}`);
      throw new Error('Failed to delete Google Calendar event');
    }
  }
}
