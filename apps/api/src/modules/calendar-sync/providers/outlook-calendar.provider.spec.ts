import { ConfigService } from '@nestjs/config';
import { OutlookCalendarProvider } from './outlook-calendar.provider';
import { CalendarEvent } from './calendar.provider.interface';

describe('OutlookCalendarProvider', () => {
  let provider: OutlookCalendarProvider;
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
          MICROSOFT_CLIENT_ID: 'ms-client-id',
          MICROSOFT_CLIENT_SECRET: 'ms-client-secret',
        };
        return config[key] ?? defaultValue;
      }),
    };
    provider = new OutlookCalendarProvider(configService as unknown as ConfigService);
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('returns true when both client ID and secret are set', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('returns false when client secret is empty', () => {
      configService.get.mockReturnValue('');
      const p = new OutlookCalendarProvider(configService as unknown as ConfigService);
      expect(p.isConfigured()).toBe(false);
    });
  });

  describe('getAuthUrl', () => {
    it('returns a valid Microsoft OAuth URL with all params', () => {
      const url = provider.getAuthUrl('http://localhost:3001/callback', 'state-abc');
      expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2/authorize');
      expect(url).toContain('client_id=ms-client-id');
      expect(url).toContain('state=state-abc');
      expect(url).toContain('scope=Calendars.ReadWrite');
    });
  });

  describe('exchangeCode', () => {
    it('exchanges code for tokens successfully', async () => {
      global.fetch = mockFetchResponse({
        access_token: 'ms-access-123',
        refresh_token: 'ms-refresh-456',
        expires_in: 3600,
      });

      const result = await provider.exchangeCode('auth-code', 'http://localhost/cb');
      expect(result.accessToken).toBe('ms-access-123');
      expect(result.refreshToken).toBe('ms-refresh-456');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://login.microsoftonline.com/common/oauth2/v2/token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws when response is not ok', async () => {
      global.fetch = mockFetchResponse({ error: 'invalid_grant' }, false, 400);
      await expect(provider.exchangeCode('bad-code', 'http://localhost/cb')).rejects.toThrow(
        'Failed to exchange Outlook auth code',
      );
    });
  });

  describe('refreshAccessToken', () => {
    it('refreshes token successfully', async () => {
      global.fetch = mockFetchResponse({
        access_token: 'ms-new-access',
        expires_in: 3600,
      });

      const result = await provider.refreshAccessToken('ms-refresh-456');
      expect(result.accessToken).toBe('ms-new-access');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('throws when refresh fails', async () => {
      global.fetch = mockFetchResponse({ error: 'invalid_grant' }, false, 401);
      await expect(provider.refreshAccessToken('bad-refresh')).rejects.toThrow(
        'Failed to refresh Outlook token',
      );
    });
  });

  describe('createEvent', () => {
    it('creates event and returns event ID', async () => {
      global.fetch = mockFetchResponse({ id: 'ms-evt-123' });

      const id = await provider.createEvent('token', 'cal-id', mockEvent);
      expect(id).toBe('ms-evt-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/events',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes location when provided', async () => {
      global.fetch = mockFetchResponse({ id: 'ms-evt-456' });

      await provider.createEvent('token', 'cal-id', mockEvent);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.location).toEqual({ displayName: 'Suite 100' });
    });

    it('omits location when not provided', async () => {
      global.fetch = mockFetchResponse({ id: 'ms-evt-789' });

      const eventNoLoc = { ...mockEvent, location: undefined };
      await provider.createEvent('token', 'cal-id', eventNoLoc);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.location).toBeUndefined();
    });

    it('throws when creation fails', async () => {
      global.fetch = mockFetchResponse({ error: 'quota exceeded' }, false, 403);
      await expect(provider.createEvent('token', 'cal1', mockEvent)).rejects.toThrow(
        'Failed to create Outlook Calendar event',
      );
    });
  });

  describe('updateEvent', () => {
    it('updates event with PATCH', async () => {
      global.fetch = mockFetchResponse({});

      await provider.updateEvent('token', 'cal-id', 'ms-evt-123', mockEvent);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/events/ms-evt-123'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('throws when update fails', async () => {
      global.fetch = mockFetchResponse({ error: 'not found' }, false, 404);
      await expect(
        provider.updateEvent('token', 'cal1', 'evt-999', mockEvent),
      ).rejects.toThrow('Failed to update Outlook Calendar event');
    });
  });

  describe('listEvents', () => {
    const timeMin = new Date('2026-03-01T00:00:00Z');
    const timeMax = new Date('2026-03-02T00:00:00Z');

    it('returns parsed events', async () => {
      global.fetch = mockFetchResponse({
        value: [
          {
            subject: 'Meeting',
            bodyPreview: 'Team sync',
            start: { dateTime: '2026-03-01T10:00:00' },
            end: { dateTime: '2026-03-01T11:00:00' },
            location: { displayName: 'Room B' },
          },
        ],
      });

      const events = await provider.listEvents('token', 'cal-id', timeMin, timeMax);
      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('Meeting');
      expect(events[0].location).toBe('Room B');
    });

    it('filters out cancelled events', async () => {
      global.fetch = mockFetchResponse({
        value: [
          {
            subject: 'Cancelled',
            isCancelled: true,
            start: { dateTime: '2026-03-01T10:00:00' },
            end: { dateTime: '2026-03-01T11:00:00' },
          },
          {
            subject: 'Active',
            start: { dateTime: '2026-03-01T12:00:00' },
            end: { dateTime: '2026-03-01T13:00:00' },
          },
        ],
      });

      const events = await provider.listEvents('token', 'cal-id', timeMin, timeMax);
      expect(events).toHaveLength(1);
      expect(events[0].summary).toBe('Active');
    });

    it('filters out events without dateTime', async () => {
      global.fetch = mockFetchResponse({
        value: [
          {
            subject: 'No Times',
            start: {},
            end: {},
          },
        ],
      });

      const events = await provider.listEvents('token', 'cal-id', timeMin, timeMax);
      expect(events).toHaveLength(0);
    });

    it('handles empty value array', async () => {
      global.fetch = mockFetchResponse({ value: [] });

      const events = await provider.listEvents('token', 'cal-id', timeMin, timeMax);
      expect(events).toHaveLength(0);
    });

    it('handles missing value field', async () => {
      global.fetch = mockFetchResponse({});

      const events = await provider.listEvents('token', 'cal-id', timeMin, timeMax);
      expect(events).toHaveLength(0);
    });

    it('throws when list fails', async () => {
      global.fetch = mockFetchResponse({ error: 'forbidden' }, false, 403);
      await expect(provider.listEvents('token', 'cal1', timeMin, timeMax)).rejects.toThrow(
        'Failed to list Outlook Calendar events',
      );
    });
  });

  describe('deleteEvent', () => {
    it('deletes event successfully', async () => {
      global.fetch = mockFetchResponse({}, true, 204);

      await provider.deleteEvent('token', 'cal-id', 'ms-evt-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/events/ms-evt-123'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('succeeds silently for 404 Not Found', async () => {
      global.fetch = mockFetchResponse({}, false, 404);

      await expect(provider.deleteEvent('token', 'cal1', 'gone-evt')).resolves.toBeUndefined();
    });

    it('throws for non-404 errors', async () => {
      global.fetch = mockFetchResponse({ error: 'forbidden' }, false, 403);
      await expect(provider.deleteEvent('token', 'cal1', 'evt-123')).rejects.toThrow(
        'Failed to delete Outlook Calendar event',
      );
    });
  });
});
