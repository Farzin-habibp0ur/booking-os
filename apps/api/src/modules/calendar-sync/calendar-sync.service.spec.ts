import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CalendarSyncService } from './calendar-sync.service';
import { PrismaService } from '../../common/prisma.service';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { OutlookCalendarProvider } from './providers/outlook-calendar.provider';
import { createMockPrisma } from '../../test/mocks';
import { encrypt, decrypt } from './crypto.util';

// Set encryption key for tests
process.env.CALENDAR_ENCRYPTION_KEY = 'a'.repeat(64);

describe('CalendarSyncService', () => {
  let service: CalendarSyncService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let googleProvider: {
    isConfigured: jest.Mock;
    getAuthUrl: jest.Mock;
    exchangeCode: jest.Mock;
    createEvent: jest.Mock;
    updateEvent: jest.Mock;
    deleteEvent: jest.Mock;
    refreshAccessToken: jest.Mock;
  };
  let outlookProvider: {
    isConfigured: jest.Mock;
    getAuthUrl: jest.Mock;
    exchangeCode: jest.Mock;
    createEvent: jest.Mock;
    updateEvent: jest.Mock;
    deleteEvent: jest.Mock;
    refreshAccessToken: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-state'),
      verify: jest.fn().mockReturnValue({ staffId: 'staff1', provider: 'google' }),
    };
    googleProvider = {
      isConfigured: jest.fn().mockReturnValue(true),
      getAuthUrl: jest.fn().mockReturnValue('https://google.com/auth'),
      exchangeCode: jest.fn().mockResolvedValue({
        accessToken: 'google-access',
        refreshToken: 'google-refresh',
        expiresAt: new Date(Date.now() + 3600000),
      }),
      createEvent: jest.fn().mockResolvedValue('event-id-123'),
      updateEvent: jest.fn().mockResolvedValue(undefined),
      deleteEvent: jest.fn().mockResolvedValue(undefined),
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: 'new-access',
        expiresAt: new Date(Date.now() + 3600000),
      }),
    };
    outlookProvider = {
      isConfigured: jest.fn().mockReturnValue(false),
      getAuthUrl: jest.fn().mockReturnValue('https://outlook.com/auth'),
      exchangeCode: jest.fn().mockResolvedValue({
        accessToken: 'outlook-access',
        refreshToken: 'outlook-refresh',
        expiresAt: new Date(Date.now() + 3600000),
      }),
      createEvent: jest.fn().mockResolvedValue('outlook-event-123'),
      updateEvent: jest.fn().mockResolvedValue(undefined),
      deleteEvent: jest.fn().mockResolvedValue(undefined),
      refreshAccessToken: jest.fn().mockResolvedValue({
        accessToken: 'new-outlook-access',
        expiresAt: new Date(Date.now() + 3600000),
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: string) => def || '') },
        },
        { provide: GoogleCalendarProvider, useValue: googleProvider },
        { provide: OutlookCalendarProvider, useValue: outlookProvider },
      ],
    }).compile();

    service = module.get(CalendarSyncService);
  });

  describe('getConnections', () => {
    it('returns connections with tokens redacted', async () => {
      prisma.calendarConnection.findMany.mockResolvedValue([
        {
          id: 'conn1',
          staffId: 'staff1',
          provider: 'google',
          accessToken: 'encrypted',
          refreshToken: 'encrypted',
          syncEnabled: true,
          lastSyncedAt: new Date(),
          lastSyncError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tokenExpiresAt: null,
          calendarId: 'primary',
          icalFeedToken: 'token123',
        },
      ] as any);

      const result = await service.getConnections('staff1');

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('accessToken');
      expect(result[0]).not.toHaveProperty('refreshToken');
      expect(result[0].provider).toBe('google');
    });
  });

  describe('getAvailableProviders', () => {
    it('returns provider availability', () => {
      const result = service.getAvailableProviders();
      expect(result).toEqual({ google: true, outlook: false });
    });
  });

  describe('initiateOAuth', () => {
    it('returns Google auth URL with signed state', async () => {
      const url = await service.initiateOAuth('staff1', 'google');

      expect(jwtService.sign).toHaveBeenCalledWith(
        { staffId: 'staff1', provider: 'google' },
        { expiresIn: '10m' },
      );
      expect(url).toBe('https://google.com/auth');
    });

    it('throws for unconfigured provider', async () => {
      await expect(service.initiateOAuth('staff1', 'outlook')).rejects.toThrow(
        'outlook calendar is not configured',
      );
    });
  });

  describe('handleOAuthCallback', () => {
    it('exchanges code, encrypts tokens, stores connection', async () => {
      prisma.calendarConnection.upsert.mockResolvedValue({} as any);

      const result = await service.handleOAuthCallback('google', 'auth-code', 'signed-state');

      expect(jwtService.verify).toHaveBeenCalledWith('signed-state');
      expect(googleProvider.exchangeCode).toHaveBeenCalled();
      expect(prisma.calendarConnection.upsert).toHaveBeenCalled();
      expect(result).toContain('/settings/calendar?connected=google');
    });
  });

  describe('disconnect', () => {
    it('deletes connection', async () => {
      prisma.calendarConnection.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.disconnect('staff1', 'google');

      expect(prisma.calendarConnection.deleteMany).toHaveBeenCalledWith({
        where: { staffId: 'staff1', provider: 'google' },
      });
    });
  });

  describe('syncBookingToCalendar', () => {
    const booking = {
      id: 'b1',
      staffId: 'staff1',
      externalCalendarEventId: null,
      startTime: new Date('2026-03-01T10:00:00Z'),
      endTime: new Date('2026-03-01T11:00:00Z'),
      status: 'CONFIRMED',
      customer: { name: 'Jane Doe' },
      service: { name: 'Botox' },
      staff: { name: 'Dr. Sarah' },
    };

    it('skips sync when booking has no staffId', async () => {
      await service.syncBookingToCalendar({ ...booking, staffId: null }, 'create');

      expect(prisma.calendarConnection.findMany).not.toHaveBeenCalled();
    });

    it('creates external event on create action', async () => {
      prisma.calendarConnection.findMany.mockResolvedValue([
        {
          id: 'conn1',
          provider: 'google',
          accessToken: encrypt('access-token'),
          refreshToken: encrypt('refresh-token'),
          tokenExpiresAt: new Date(Date.now() + 3600000),
          calendarId: 'primary',
          syncEnabled: true,
        },
      ] as any);
      prisma.booking.update.mockResolvedValue({} as any);
      prisma.calendarConnection.update.mockResolvedValue({} as any);

      await service.syncBookingToCalendar(booking, 'create');

      expect(googleProvider.createEvent).toHaveBeenCalled();
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { externalCalendarEventId: 'event-id-123' },
      });
    });

    it('deletes external event on cancel action', async () => {
      prisma.calendarConnection.findMany.mockResolvedValue([
        {
          id: 'conn1',
          provider: 'google',
          accessToken: encrypt('access-token'),
          refreshToken: encrypt('refresh-token'),
          tokenExpiresAt: new Date(Date.now() + 3600000),
          calendarId: 'primary',
          syncEnabled: true,
        },
      ] as any);
      prisma.calendarConnection.update.mockResolvedValue({} as any);

      await service.syncBookingToCalendar(
        { ...booking, externalCalendarEventId: 'ext-event-1' },
        'cancel',
      );

      expect(googleProvider.deleteEvent).toHaveBeenCalledWith(
        'access-token',
        'primary',
        'ext-event-1',
      );
    });
  });

  describe('generateIcalFeed', () => {
    it('returns null for unknown token', async () => {
      prisma.calendarConnection.findUnique.mockResolvedValue(null);

      const result = await service.generateIcalFeed('bad-token');

      expect(result).toBeNull();
    });

    it('generates valid VCALENDAR string', async () => {
      prisma.calendarConnection.findUnique.mockResolvedValue({
        staffId: 'staff1',
        staff: { name: 'Dr. Sarah' },
      } as any);
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          startTime: new Date('2026-03-01T10:00:00Z'),
          endTime: new Date('2026-03-01T11:00:00Z'),
          createdAt: new Date('2026-02-15T00:00:00Z'),
          status: 'CONFIRMED',
          customer: { name: 'Jane' },
          service: { name: 'Botox' },
        },
      ] as any);

      const feed = await service.generateIcalFeed('valid-token');

      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('BEGIN:VEVENT');
      expect(feed).toContain('Botox - Jane');
      expect(feed).toContain('END:VCALENDAR');
    });
  });

  describe('crypto round-trip', () => {
    it('encrypts and decrypts correctly', () => {
      const original = 'my-secret-oauth-token-12345';
      const encrypted = encrypt(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted).toContain(':');
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(original);
    });
  });
});
