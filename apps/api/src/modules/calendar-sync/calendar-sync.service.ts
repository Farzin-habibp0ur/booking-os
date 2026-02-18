import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma.service';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { OutlookCalendarProvider } from './providers/outlook-calendar.provider';
import { CalendarProvider, CalendarEvent } from './providers/calendar.provider.interface';
import { encrypt, decrypt } from './crypto.util';
import { randomBytes } from 'crypto';

interface BookingForSync {
  id: string;
  staffId?: string | null;
  externalCalendarEventId?: string | null;
  startTime: Date;
  endTime: Date;
  status: string;
  customer: { name: string };
  service: { name: string };
  staff?: { name: string } | null;
}

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);
  private readonly apiUrl: string;
  private readonly webUrl: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private jwtService: JwtService,
    private googleProvider: GoogleCalendarProvider,
    private outlookProvider: OutlookCalendarProvider,
  ) {
    this.apiUrl = this.config.get<string>('API_URL', 'http://localhost:3001');
    this.webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
  }

  private getProvider(provider: string): CalendarProvider & { isConfigured(): boolean } {
    if (provider === 'google') return this.googleProvider;
    if (provider === 'outlook') return this.outlookProvider;
    throw new Error(`Unknown provider: ${provider}`);
  }

  async getConnections(staffId: string) {
    const connections = await this.prisma.calendarConnection.findMany({
      where: { staffId },
    });
    return connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      syncEnabled: c.syncEnabled,
      lastSyncedAt: c.lastSyncedAt,
      lastSyncError: c.lastSyncError,
      createdAt: c.createdAt,
    }));
  }

  getAvailableProviders() {
    return {
      google: this.googleProvider.isConfigured(),
      outlook: this.outlookProvider.isConfigured(),
    };
  }

  async initiateOAuth(staffId: string, provider: string): Promise<string> {
    const providerImpl = this.getProvider(provider);
    if (!providerImpl.isConfigured()) {
      throw new Error(`${provider} calendar is not configured`);
    }

    const state = this.jwtService.sign({ staffId, provider }, { expiresIn: '10m' });

    const redirectUri = `${this.apiUrl}/api/v1/calendar-sync/callback/${provider}`;
    return providerImpl.getAuthUrl(redirectUri, state);
  }

  async handleOAuthCallback(provider: string, code: string, state: string): Promise<string> {
    const payload = this.jwtService.verify(state);
    const { staffId } = payload;

    const providerImpl = this.getProvider(provider);
    const redirectUri = `${this.apiUrl}/api/v1/calendar-sync/callback/${provider}`;
    const tokens = await providerImpl.exchangeCode(code, redirectUri);

    const icalFeedToken = randomBytes(32).toString('hex');
    // H7 fix: Set iCal feed token expiry to 90 days
    const icalFeedTokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    await this.prisma.calendarConnection.upsert({
      where: { staffId_provider: { staffId, provider } },
      create: {
        staffId,
        provider,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        calendarId: provider === 'google' ? 'primary' : null,
        icalFeedToken,
        icalFeedTokenExpiresAt,
        syncEnabled: true,
      },
      update: {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        syncEnabled: true,
        lastSyncError: null,
      },
    });

    return `${this.webUrl}/settings/calendar?connected=${provider}`;
  }

  async disconnect(staffId: string, provider: string) {
    await this.prisma.calendarConnection.deleteMany({
      where: { staffId, provider },
    });
  }

  async pullExternalEvents(
    staffId: string,
    date: string, // YYYY-MM-DD
  ): Promise<CalendarEvent[]> {
    const connections = await this.prisma.calendarConnection.findMany({
      where: { staffId, syncEnabled: true },
    });

    const dayStart = new Date(date + 'T00:00:00Z');
    const dayEnd = new Date(date + 'T23:59:59Z');
    const allEvents: CalendarEvent[] = [];

    for (const connection of connections) {
      try {
        const provider = this.getProvider(connection.provider);
        let accessToken = decrypt(connection.accessToken);

        // Refresh token if expired
        if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
          const refreshToken = decrypt(connection.refreshToken);
          const refreshed = await provider.refreshAccessToken(refreshToken);
          accessToken = refreshed.accessToken;

          await this.prisma.calendarConnection.update({
            where: { id: connection.id },
            data: {
              accessToken: encrypt(refreshed.accessToken),
              tokenExpiresAt: refreshed.expiresAt,
            },
          });
        }

        const events = await provider.listEvents(
          accessToken,
          connection.calendarId || 'primary',
          dayStart,
          dayEnd,
        );
        allEvents.push(...events);
      } catch (error) {
        this.logger.error(
          `Failed to pull events from ${connection.provider} for staff ${staffId}: ${error}`,
        );
      }
    }

    return allEvents;
  }

  async syncBookingToCalendar(
    booking: BookingForSync,
    action: 'create' | 'update' | 'cancel',
  ): Promise<void> {
    if (!booking.staffId) return;

    const connections = await this.prisma.calendarConnection.findMany({
      where: { staffId: booking.staffId, syncEnabled: true },
    });

    for (const connection of connections) {
      try {
        const provider = this.getProvider(connection.provider);
        let accessToken = decrypt(connection.accessToken);

        // Refresh token if expired
        if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
          const refreshToken = decrypt(connection.refreshToken);
          const refreshed = await provider.refreshAccessToken(refreshToken);
          accessToken = refreshed.accessToken;

          await this.prisma.calendarConnection.update({
            where: { id: connection.id },
            data: {
              accessToken: encrypt(refreshed.accessToken),
              tokenExpiresAt: refreshed.expiresAt,
            },
          });
        }

        const event: CalendarEvent = {
          summary: `${booking.service.name} - ${booking.customer.name}`,
          description: `Booking with ${booking.customer.name} for ${booking.service.name}`,
          startTime: booking.startTime,
          endTime: booking.endTime,
        };

        if (action === 'create') {
          const eventId = await provider.createEvent(
            accessToken,
            connection.calendarId || 'primary',
            event,
          );
          await this.prisma.booking.update({
            where: { id: booking.id },
            data: { externalCalendarEventId: eventId },
          });
        } else if (action === 'update' && booking.externalCalendarEventId) {
          await provider.updateEvent(
            accessToken,
            connection.calendarId || 'primary',
            booking.externalCalendarEventId,
            event,
          );
        } else if (action === 'cancel' && booking.externalCalendarEventId) {
          await provider.deleteEvent(
            accessToken,
            connection.calendarId || 'primary',
            booking.externalCalendarEventId,
          );
        }

        await this.prisma.calendarConnection.update({
          where: { id: connection.id },
          data: { lastSyncedAt: new Date(), lastSyncError: null },
        });
      } catch (error) {
        this.logger.error(
          `Calendar sync failed for connection ${connection.id}: ${error}`,
          (error as Error).stack,
        );
        try {
          await this.prisma.calendarConnection.update({
            where: { id: connection.id },
            data: { lastSyncError: error instanceof Error ? error.message : String(error) },
          });
        } catch (updateErr) {
          this.logger.error(
            `Failed to persist lastSyncError for connection ${connection.id}: ${(updateErr as Error).message}`,
            (updateErr as Error).stack,
          );
        }
      }
    }
  }

  async generateIcalFeed(icalFeedToken: string): Promise<string | null | 'EXPIRED'> {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: { icalFeedToken },
      include: { staff: true },
    });

    if (!connection) return null;

    // H7 fix: Reject expired iCal feed tokens
    if (connection.icalFeedTokenExpiresAt && connection.icalFeedTokenExpiresAt < new Date()) {
      return 'EXPIRED';
    }

    const now = new Date();
    const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const future90d = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const bookings = await this.prisma.booking.findMany({
      where: {
        staffId: connection.staffId,
        status: { in: ['CONFIRMED', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] },
        startTime: { gte: past30d, lte: future90d },
      },
      include: { customer: true, service: true },
      orderBy: { startTime: 'asc' },
    });

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Booking OS//Calendar Feed//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${connection.staff.name} - Bookings`,
    ];

    for (const booking of bookings) {
      const uid = `${booking.id}@bookingos`;
      const dtStart = this.formatIcalDate(booking.startTime);
      const dtEnd = this.formatIcalDate(booking.endTime);
      const created = this.formatIcalDate(booking.createdAt);
      const summary = this.escapeIcal(`${booking.service.name} - ${booking.customer.name}`);
      const description = this.escapeIcal(
        `Booking with ${booking.customer.name} for ${booking.service.name}`,
      );

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `DTSTAMP:${created}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `STATUS:${booking.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  async getIcalFeedUrl(staffId: string): Promise<string | null> {
    const connection = await this.prisma.calendarConnection.findFirst({
      where: { staffId, icalFeedToken: { not: null } },
    });

    if (!connection?.icalFeedToken) return null;
    return `${this.apiUrl}/api/v1/ical/${connection.icalFeedToken}.ics`;
  }

  async regenerateIcalToken(staffId: string): Promise<string> {
    const newToken = randomBytes(32).toString('hex');
    // H7 fix: Set iCal feed token expiry to 90 days
    const icalFeedTokenExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    // Update all connections for this staff member
    await this.prisma.calendarConnection.updateMany({
      where: { staffId },
      data: { icalFeedToken: null, icalFeedTokenExpiresAt: null },
    });

    // Set new token on the first connection
    const connection = await this.prisma.calendarConnection.findFirst({
      where: { staffId },
    });

    if (connection) {
      await this.prisma.calendarConnection.update({
        where: { id: connection.id },
        data: { icalFeedToken: newToken, icalFeedTokenExpiresAt },
      });
    }

    return `${this.apiUrl}/api/v1/ical/${newToken}.ics`;
  }

  private formatIcalDate(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  private escapeIcal(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }
}
