import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PushNotificationService } from './push-notification.service';
import { DeviceTokenService } from '../device-token/device-token.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let deviceTokenService: any;

  beforeEach(async () => {
    deviceTokenService = {
      findActiveByStaff: jest.fn(),
      findActiveByBusiness: jest.fn(),
      unregister: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: DeviceTokenService, useValue: deviceTokenService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined), // FCM not configured
          },
        },
      ],
    }).compile();

    service = module.get(PushNotificationService);
  });

  describe('sendToStaff', () => {
    it('should log notification when FCM is not configured', async () => {
      deviceTokenService.findActiveByStaff.mockResolvedValue([
        { id: 'dt-1', token: 'abc123456789', platform: 'ios' },
      ]);

      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      await service.sendToStaff('s1', { title: 'New Message', body: 'You have a new message' });

      expect(deviceTokenService.findActiveByStaff).toHaveBeenCalledWith('s1');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Push - dry run]'));
    });

    it('should do nothing when no active tokens', async () => {
      deviceTokenService.findActiveByStaff.mockResolvedValue([]);

      await service.sendToStaff('s1', { title: 'Test', body: 'Test body' });

      // Should not throw
    });
  });

  describe('sendToBusiness', () => {
    it('should send to all business tokens', async () => {
      deviceTokenService.findActiveByBusiness.mockResolvedValue([
        { id: 'dt-1', token: 'token1abcdef', platform: 'ios' },
        { id: 'dt-2', token: 'token2abcdef', platform: 'android' },
      ]);

      const logSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      await service.sendToBusiness('b1', { title: 'Update', body: 'Business update' });

      expect(deviceTokenService.findActiveByBusiness).toHaveBeenCalledWith('b1');
      expect(logSpy).toHaveBeenCalledTimes(2);
    });

    it('should do nothing when no active tokens', async () => {
      deviceTokenService.findActiveByBusiness.mockResolvedValue([]);

      await service.sendToBusiness('b1', { title: 'Test', body: 'Test' });
    });
  });

  describe('graceful degradation', () => {
    it('should not crash when FCM is not configured', async () => {
      deviceTokenService.findActiveByStaff.mockResolvedValue([
        { id: 'dt-1', token: 'token12345678', platform: 'ios' },
      ]);

      jest.spyOn(service['logger'], 'log').mockImplementation();

      await expect(
        service.sendToStaff('s1', { title: 'Test', body: 'Test' }),
      ).resolves.not.toThrow();
    });
  });
});
