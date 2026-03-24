import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InstagramAuthController } from './instagram-auth.controller';
import { InstagramAuthService } from './instagram-auth.service';
import { MessagingService } from '../messaging/messaging.service';

describe('InstagramAuthController', () => {
  let controller: InstagramAuthController;
  let mockService: Record<string, jest.Mock>;
  let mockConfigService: { get: jest.Mock };
  let mockMessagingService: Record<string, jest.Mock>;
  let mockRes: { redirect: jest.Mock };

  beforeEach(async () => {
    mockService = {
      getAuthorizeUrl: jest
        .fn()
        .mockReturnValue('https://www.facebook.com/v21.0/dialog/oauth?client_id=app-id'),
      handleCallback: jest.fn().mockResolvedValue({ pageName: 'Test Page', pageId: 'page-1' }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockResolvedValue({
        connected: true,
        pageName: 'Test Page',
        pageId: 'page-1',
        tokenExpiresAt: '2026-05-01',
      }),
      getLocationConfig: jest.fn().mockResolvedValue({ pageId: 'page-1', pageAccessToken: 'tok' }),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          API_URL: 'http://localhost:3001',
          NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        };
        return config[key] ?? defaultValue;
      }),
    };

    mockMessagingService = {
      getProviderForLocationInstagramConfig: jest.fn().mockReturnValue({
        setIceBreakers: jest.fn().mockResolvedValue(undefined),
      }),
    };

    mockRes = { redirect: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [InstagramAuthController],
      providers: [
        { provide: InstagramAuthService, useValue: mockService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MessagingService, useValue: mockMessagingService },
      ],
    }).compile();

    controller = module.get(InstagramAuthController);
  });

  // ─── authorize ─────────────────────────────────────────────

  describe('authorize', () => {
    it('should redirect to OAuth URL with base64 state containing businessId and locationId', () => {
      controller.authorize('biz1', 'loc1', mockRes as any);

      expect(mockService.getAuthorizeUrl).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/instagram-auth/callback',
      );
      expect(mockRes.redirect).toHaveBeenCalledTimes(1);

      const redirectUrl = mockRes.redirect.mock.calls[0][0] as string;
      expect(redirectUrl).toContain('&state=');

      // Decode and verify state
      const stateParam = redirectUrl.split('&state=')[1];
      const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf8'));
      expect(state).toEqual({ businessId: 'biz1', locationId: 'loc1' });
    });

    it('should throw BadRequestException when locationId is missing', () => {
      expect(() => controller.authorize('biz1', '', mockRes as any)).toThrow(BadRequestException);
    });
  });

  // ─── callback ──────────────────────────────────────────────

  describe('callback', () => {
    const validState = Buffer.from(
      JSON.stringify({ businessId: 'biz1', locationId: 'loc1' }),
    ).toString('base64');

    it('should decode state, call handleCallback, and redirect to frontend', async () => {
      await controller.callback('auth-code', validState, mockRes as any);

      expect(mockService.handleCallback).toHaveBeenCalledWith(
        'biz1',
        'loc1',
        'auth-code',
        'http://localhost:3001/api/v1/instagram-auth/callback',
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/settings/integrations?instagram=connected',
      );
    });

    it('should throw BadRequestException when code is missing', async () => {
      await expect(controller.callback('', validState, mockRes as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when state is missing', async () => {
      await expect(controller.callback('code', '', mockRes as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── disconnect ────────────────────────────────────────────

  describe('disconnect', () => {
    it('should delegate to service and return { ok: true }', async () => {
      const result = await controller.disconnect('biz1', 'loc1');

      expect(mockService.disconnect).toHaveBeenCalledWith('biz1', 'loc1');
      expect(result).toEqual({ ok: true });
    });
  });

  // ─── status ────────────────────────────────────────────────

  describe('status', () => {
    it('should delegate to service.getStatus', async () => {
      const result = await controller.status('biz1', 'loc1');

      expect(mockService.getStatus).toHaveBeenCalledWith('biz1', 'loc1');
      expect(result).toEqual({
        connected: true,
        pageName: 'Test Page',
        pageId: 'page-1',
        tokenExpiresAt: '2026-05-01',
      });
    });
  });

  // ─── setIceBreakers ────────────────────────────────────────

  describe('setIceBreakers', () => {
    const validPrompts = {
      prompts: [
        { question: 'Book an appointment?', payload: 'BOOK' },
        { question: 'See our services?', payload: 'SERVICES' },
      ],
    };

    it('should validate, get config, get provider, set ice breakers, return { ok: true }', async () => {
      const result = await controller.setIceBreakers('biz1', 'loc1', validPrompts);

      expect(mockService.getStatus).toHaveBeenCalledWith('biz1', 'loc1');
      expect(mockService.getLocationConfig).toHaveBeenCalledWith('biz1', 'loc1');
      expect(mockMessagingService.getProviderForLocationInstagramConfig).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });

    it('should throw when prompts array is empty', async () => {
      await expect(controller.setIceBreakers('biz1', 'loc1', { prompts: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when prompts array has more than 4 items', async () => {
      const tooMany = {
        prompts: Array.from({ length: 5 }, (_, i) => ({
          question: `Q${i}`,
          payload: `P${i}`,
        })),
      };

      await expect(controller.setIceBreakers('biz1', 'loc1', tooMany)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when Instagram is not connected', async () => {
      mockService.getStatus.mockResolvedValue({ connected: false });

      await expect(controller.setIceBreakers('biz1', 'loc1', validPrompts)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw when provider is not available', async () => {
      mockMessagingService.getProviderForLocationInstagramConfig.mockReturnValue(null);

      await expect(controller.setIceBreakers('biz1', 'loc1', validPrompts)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
