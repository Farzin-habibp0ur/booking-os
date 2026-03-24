import { Test, TestingModule } from '@nestjs/testing';
import { DeviceTokenController } from './device-token.controller';
import { DeviceTokenService } from './device-token.service';

describe('DeviceTokenController', () => {
  let controller: DeviceTokenController;
  let service: any;

  beforeEach(async () => {
    service = {
      register: jest.fn(),
      unregister: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceTokenController],
      providers: [{ provide: DeviceTokenService, useValue: service }],
    }).compile();

    controller = module.get(DeviceTokenController);
  });

  describe('register', () => {
    it('should register a device token', async () => {
      service.register.mockResolvedValue({ id: 'dt-1' });

      const result = await controller.register(
        { token: 'abc123', platform: 'ios' },
        { user: { staffId: 's1' } },
        'b1',
      );

      expect(service.register).toHaveBeenCalledWith('s1', 'b1', 'abc123', 'ios');
      expect(result).toEqual({ id: 'dt-1', registered: true });
    });

    it('should use sub if staffId not present', async () => {
      service.register.mockResolvedValue({ id: 'dt-2' });

      const result = await controller.register(
        { token: 'abc123', platform: 'android' },
        { user: { sub: 's2' } },
        'b1',
      );

      expect(service.register).toHaveBeenCalledWith('s2', 'b1', 'abc123', 'android');
      expect(result).toEqual({ id: 'dt-2', registered: true });
    });
  });

  describe('unregister', () => {
    it('should deactivate a device token', async () => {
      service.unregister.mockResolvedValue({ count: 1 });

      const result = await controller.unregister('abc123');

      expect(service.unregister).toHaveBeenCalledWith('abc123');
      expect(result).toEqual({ deactivated: true });
    });
  });
});
