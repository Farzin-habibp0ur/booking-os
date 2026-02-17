import { ConfigService } from '@nestjs/config';
import { GoogleCalendarProvider } from './google-calendar.provider';
import { CalendarEvent } from './calendar.provider.interface';

describe('GoogleCalendarProvider', () => {
  let provider: GoogleCalendarProvider;
  let configService: { get: jest.Mock };

  const mockEvent: CalendarEvent = {
    summary: 'Test Appointment',
    description: 'Test description',
    startTime: new Date('2026-03-01T10:00:00Z'),
    endTime: new Date('2026-03-01T11:00:00Z'),
    location: 'Suite 100',
  };

  function mockFetchResponse(body: any, ok = true, status = 200) {
    return jest.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    });
  }

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          GOOGLE_CLIENT_ID: 'test-client-id',
          GOOGLE_CLIENT_SECRET: 'test-client-secret',
        };
        return config[key] ?? defaultValue;
      }),
    };
    provider = new GoogleCalendarProvider(configService as unknown as ConfigService);
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('returns true when both client ID and secret are set', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when client ID is empty', () => {
      configService.get.mockReturnValue('');
      const p = new GoogleCalendarProvider(configService as unknown as ConfigService);
      expect(p.isConfigured()).toBe(false);
    });
  });

  describe('getAuthUrl', () => {
    it('returns a valid Google OAuth URL with all params', () => {
      const url = provider.getAuthUrl('http://localhost:3001/callback', 'state123');
      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=state123');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for tokens successfully', async () => {
      global.fetch = mockFetchResponse({
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_in: 3600,
      });

      const result = await provider.exchangeCode('auth-code', 'http://localhost/cb');
      expect(result.accessToken).toBe('access-123');
      expect(result.refreshToken).toBe('refresh-456');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws when response is not ok', async () => {
      global.fetch = mockFetchResponse({ error: 'invalid_grant' }, false, 400);
      await expect(provider.exchangeCode('bad-code', 'http://localhost/cb')).rejects.toThrow(
        'Failed to exchange Google auth code',
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes token successfully', async () => {
      global.fetch = mockFetchResponse({
        access_token: 'new-access-789',
        expires_in: 3600,
      });

      const result = await provider.refreshAccessToken('refresh-456');
      expect(result.accessToken).toBe('new-access-789');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('throws when refresh fails', async () => {
      global.fetch = mockFetchResponse({ error: 'invalid_grant' }, false, 401);
      await expect(provider.refreshAccessToken('bad-refresh')).rejects.toThrow(
        'Failed to refresh Google token',
      );
    });
  });

  describe('createEvent', () => {
    it('creates event and returns event ID', async () => {
      global.fetch = mockFetchResponse({ id: 'evt-123' });

      const id = await provider.createEvent('access-token', 'primary', mockEvent);
      expect(id).toBe('evt-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/primary/events'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('uses "primary" when calendarId is empty', async () => {
      global.fetch = mockFetchResponse({ id: 'evt-456' });

      await provider.createEvent('access-token', '', mockEvent);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/primary/events'),
        expect.anything(),
      );
    });

    it('throws when creation fails', async () => {
      global.fetch = mockFetchResponse({ error: 'quota exceeded' }, false, 403);
      await expect(provider.createEvent('token', 'cal1', mockEvent)).rejects.toThrow(
        'Failed to create Google Calendar event',
      );
    });
  });

  describe('updateEvent', () => {
    it('updates event with PATCH', async () => {
      global.fetch = mockFetchResponse({});

      await provider.updateEvent('access-token', 'primary', 'evt-123', mockEvent);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/events/evt-123'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('throws when update fails', async () => {
      global.fetch = mockFetchResponse({ error: 'not found' }, false, 404);
      await expect(provider.updateEvent('token', 'cal1', 'evt-999', mockEvent)).rejects.toThrow(
        'Failed to update Google Calendar event',
      );
    });
  });

  describe('listEvents', () => {
    const timeMin = new Date('2026-03-01T00:00:00Z');
    const timeMax = new Date('2026-03-02T00:00:00Z');

    it('returns parsed events', async () => {
      global.fetch = mockFetchResponse({
        items: [
          {
            summary: 'Meeting',
            description: 'Team sync',
            start: { dateTime: '2026-03-01T10:00:00Z' },
            end: { dateTime: '2026-03-01T11:00:00Z' },
            location: 'Room A',
          },
        ],
      });

      const events = await provider.listEvents('token', 'primary', timeMin, timeMax);
      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('Meeting');
      expect(events[0].startTime).toEqual(new Date('2026-03-01T10:00:00Z'));
    });

    it('filters out cancelled events', async () => {
      global.fetch = mockFetchResponse({
        items: [
          {
            summary: 'Cancelled',
            status: 'cancelled',
            start: { dateTime: '2026-03-01T10:00:00Z' },
            end: { dateTime: '2026-03-01T11:00:00Z' },
          },
          {
            summary: 'Active',
            start: { dateTime: '2026-03-01T12:00:00Z' },
            end: { dateTime: '2026-03-01T13:00:00Z' },
          },
        ],
      });

      const events = await provider.listEvents('token', 'primary', timeMin, timeMax);
      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('Active');
    });

    it('filters out all-day events (no dateTime)', async () => {
      global.fetch = mockFetchResponse({
        items: [
          {
            summary: 'All Day',
            start: { date: '2026-03-01' },
            end: { date: '2026-03-02' },
          },
        ],
      });

      const events = await provider.listEvents('token', 'primary', timeMin, timeMax);
      expect(events).toHaveLength(0);
    });

    it('handles empty items array', async () => {
      global.fetch = mockFetchResponse({ items: [] });

      const events = await provider.listEvents('token', 'primary', timeMin, timeMax);
      expect(events).toHaveLength(0);
    });

    it('handles missing items field', async () => {
      global.fetch = mockFetchResponse({});

      const events = await provider.listEvents('token', 'primary', timeMin, timeMax);
      expect(events).toHaveLength(0);
    });

    it('throws when list fails', async () => {
      global.fetch = mockFetchResponse({ error: 'forbidden' }, false, 403);
      await expect(provider.listEvents('token', 'cal1', timeMin, timeMax)).rejects.toThrow(
        'Failed to list Google Calendar events',
      );
    });
  });

  describe('deleteEvent', () => {
    it('deletes event successfully', async () => {
      global.fetch = mockFetchResponse({}, true, 204);

      await provider.deleteEvent('token', 'primary', 'evt-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/events/evt-123'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('succeeds silently for 410 Gone', async () => {
      global.fetch = mockFetchResponse({}, false, 410);

      await expect(provider.deleteEvent('token', 'cal1', 'gone-evt')).resolves.toBeUndefined();
    });

    it('throws for non-410 errors', async () => {
      global.fetch = mockFetchResponse({ error: 'forbidden' }, false, 403);
      await expect(provider.deleteEvent('token', 'cal1', 'evt-123')).rejects.toThrow(
        'Failed to delete Google Calendar event',
      );
    });
  });
});
