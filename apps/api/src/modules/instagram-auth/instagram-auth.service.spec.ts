import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstagramAuthService } from './instagram-auth.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';
import { Prisma } from '@booking-os/db';

describe('InstagramAuthService', () => {
  let service: InstagramAuthService;
  let prisma: MockPrisma;
  let configService: { get: jest.Mock };
  let originalFetch: typeof global.fetch;

  const mockConfig: Record<string, string> = {
    INSTAGRAM_APP_ID: 'test-app-id',
    INSTAGRAM_APP_SECRET: 'test-app-secret',
    API_URL: 'http://localhost:3001',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  };

  beforeEach(async () => {
    originalFetch = global.fetch;
    prisma = createMockPrisma();
    configService = {
      get: jest.fn((key: string, defaultValue?: string) => mockConfig[key] ?? defaultValue),
    };

    const module = await Test.createTestingModule({
      providers: [
        InstagramAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(InstagramAuthService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ─── getAuthorizeUrl ───────────────────────────────────────

  describe('getAuthorizeUrl', () => {
    it('should return a Facebook OAuth v21.0 URL with client_id and redirect_uri', () => {
      const url = service.getAuthorizeUrl('http://localhost:3001/api/v1/instagram-auth/callback');

      expect(url).toContain('https://www.facebook.com/v21.0/dialog/oauth');
      expect(url).toContain('client_id=test-app-id');
      expect(url).toContain(
        'redirect_uri=' +
          encodeURIComponent('http://localhost:3001/api/v1/instagram-auth/callback'),
      );
    });

    it('should include all 4 required scopes', () => {
      const url = service.getAuthorizeUrl('http://localhost:3001/callback');

      expect(url).toContain('instagram_basic');
      expect(url).toContain('instagram_manage_messages');
      expect(url).toContain('pages_manage_metadata');
      expect(url).toContain('pages_show_list');
    });

    it('should throw BadRequestException when INSTAGRAM_APP_ID is not configured', () => {
      configService.get.mockImplementation(() => undefined);

      expect(() => service.getAuthorizeUrl('http://localhost:3001/callback')).toThrow(
        BadRequestException,
      );
    });
  });

  // ─── handleCallback ────────────────────────────────────────

  describe('handleCallback', () => {
    const mockFetchSequence = (
      shortToken = { access_token: 'short-token' },
      longToken = { access_token: 'long-token', expires_in: 5184000 },
      pages = {
        data: [
          {
            id: 'page-1',
            name: 'Test Page',
            access_token: 'page-token',
            instagram_business_account: { id: 'ig-biz-1' },
          },
        ],
      },
    ) => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => shortToken,
          text: async () => JSON.stringify(shortToken),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => longToken,
          text: async () => JSON.stringify(longToken),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => pages,
          text: async () => JSON.stringify(pages),
        });
    };

    it('should complete full OAuth flow and store instagramConfig', async () => {
      mockFetchSequence();
      (prisma.location.update as jest.Mock).mockResolvedValue({});

      const result = await service.handleCallback('biz1', 'loc1', 'auth-code', 'http://redirect');

      expect(result).toEqual({ pageName: 'Test Page', pageId: 'page-1' });
      expect(prisma.location.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'loc1' },
          data: {
            instagramConfig: expect.objectContaining({
              pageId: 'page-1',
              pageName: 'Test Page',
              pageAccessToken: 'page-token',
              instagramBusinessAccountId: 'ig-biz-1',
            }),
          },
        }),
      );
    });

    it('should store correct config shape with connectedAt and tokenExpiresAt', async () => {
      mockFetchSequence();
      (prisma.location.update as jest.Mock).mockResolvedValue({});

      await service.handleCallback('biz1', 'loc1', 'auth-code', 'http://redirect');

      const updateCall = (prisma.location.update as jest.Mock).mock.calls[0][0];
      const config = updateCall.data.instagramConfig;
      expect(config).toHaveProperty('connectedAt');
      expect(config).toHaveProperty('tokenExpiresAt');
      expect(new Date(config.connectedAt).getTime()).not.toBeNaN();
      expect(new Date(config.tokenExpiresAt).getTime()).not.toBeNaN();
    });

    it('should throw when INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET is missing', async () => {
      configService.get.mockImplementation(() => undefined);

      await expect(
        service.handleCallback('biz1', 'loc1', 'code', 'http://redirect'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when short-lived token exchange fails', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid code',
      });

      await expect(
        service.handleCallback('biz1', 'loc1', 'bad-code', 'http://redirect'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when long-lived token exchange fails', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'short' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Exchange failed',
        });

      await expect(
        service.handleCallback('biz1', 'loc1', 'code', 'http://redirect'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when pages fetch fails', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'short' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'long', expires_in: 5184000 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'Pages error',
        });

      await expect(
        service.handleCallback('biz1', 'loc1', 'code', 'http://redirect'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when no page has instagram_business_account', async () => {
      mockFetchSequence(undefined, undefined, {
        data: [{ id: 'page-1', name: 'No IG', access_token: 'tok' }] as any,
      });

      await expect(
        service.handleCallback('biz1', 'loc1', 'code', 'http://redirect'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── disconnect ────────────────────────────────────────────

  describe('disconnect', () => {
    it('should set instagramConfig to DbNull', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc1',
        businessId: 'biz1',
      });
      (prisma.location.update as jest.Mock).mockResolvedValue({});

      await service.disconnect('biz1', 'loc1');

      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: 'loc1' },
        data: { instagramConfig: Prisma.DbNull },
      });
    });

    it('should throw when location not found', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.disconnect('biz1', 'bad-loc')).rejects.toThrow(BadRequestException);
    });

    it('should verify tenant isolation in findFirst', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc1',
        businessId: 'biz1',
      });
      (prisma.location.update as jest.Mock).mockResolvedValue({});

      await service.disconnect('biz1', 'loc1');

      expect(prisma.location.findFirst).toHaveBeenCalledWith({
        where: { id: 'loc1', businessId: 'biz1' },
      });
    });
  });

  // ─── getStatus ─────────────────────────────────────────────

  describe('getStatus', () => {
    it('should return connected status with metadata when config exists', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc1',
        businessId: 'biz1',
        instagramConfig: {
          pageId: 'page-1',
          pageName: 'Test Page',
          tokenExpiresAt: '2026-05-01T00:00:00Z',
        },
      });

      const result = await service.getStatus('biz1', 'loc1');

      expect(result).toEqual({
        connected: true,
        pageName: 'Test Page',
        pageId: 'page-1',
        tokenExpiresAt: '2026-05-01T00:00:00Z',
      });
    });

    it('should return connected: false when instagramConfig is null', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc1',
        businessId: 'biz1',
        instagramConfig: null,
      });

      const result = await service.getStatus('biz1', 'loc1');

      expect(result).toEqual({ connected: false });
    });

    it('should return connected: false when config has no pageId', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc1',
        businessId: 'biz1',
        instagramConfig: { pageName: 'Test' },
      });

      const result = await service.getStatus('biz1', 'loc1');

      expect(result).toEqual({ connected: false });
    });

    it('should throw when location not found', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getStatus('biz1', 'bad-loc')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getLocationConfig ─────────────────────────────────────

  describe('getLocationConfig', () => {
    it('should return instagramConfig JSON when location exists', async () => {
      const config = { pageId: 'page-1', pageName: 'Test' };
      (prisma.location.findFirst as jest.Mock).mockResolvedValue({
        id: 'loc1',
        instagramConfig: config,
      });

      const result = await service.getLocationConfig('biz1', 'loc1');

      expect(result).toEqual(config);
    });

    it('should return null when location has no config or does not exist', async () => {
      (prisma.location.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getLocationConfig('biz1', 'bad-loc');

      expect(result).toBeNull();
    });
  });

  // ─── refreshExpiringTokens ─────────────────────────────────

  describe('refreshExpiringTokens', () => {
    const makeLocation = (id: string, expiresAt: string, token = 'old-token') => ({
      id,
      isActive: true,
      instagramConfig: {
        pageId: 'page-1',
        pageName: 'Test',
        pageAccessToken: token,
        instagramBusinessAccountId: 'ig-1',
        connectedAt: '2026-01-01T00:00:00Z',
        tokenExpiresAt: expiresAt,
      },
    });

    it('should refresh tokens expiring within 10 days', async () => {
      const expiringIn5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      (prisma.location.findMany as jest.Mock).mockResolvedValue([
        makeLocation('loc1', expiringIn5Days),
      ]);
      (prisma.location.update as jest.Mock).mockResolvedValue({});

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'new-token', expires_in: 5184000 }),
      });

      await service.refreshExpiringTokens();

      expect(prisma.location.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'loc1' },
          data: {
            instagramConfig: expect.objectContaining({
              pageAccessToken: 'new-token',
            }),
          },
        }),
      );
    });

    it('should skip tokens expiring more than 10 days from now', async () => {
      const expiringIn30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      (prisma.location.findMany as jest.Mock).mockResolvedValue([
        makeLocation('loc1', expiringIn30Days),
      ]);

      await service.refreshExpiringTokens();

      expect(prisma.location.update).not.toHaveBeenCalled();
    });

    it('should continue processing when one refresh fails', async () => {
      const expiringIn5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      (prisma.location.findMany as jest.Mock).mockResolvedValue([
        makeLocation('loc1', expiringIn5Days),
        makeLocation('loc2', expiringIn5Days),
      ]);
      (prisma.location.update as jest.Mock).mockResolvedValue({});

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: false, text: async () => 'fail' })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'new-token-2', expires_in: 5184000 }),
        });

      await service.refreshExpiringTokens();

      // loc1 failed but loc2 should still be updated
      expect(prisma.location.update).toHaveBeenCalledTimes(1);
      expect(prisma.location.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'loc2' } }),
      );
    });
  });
});
