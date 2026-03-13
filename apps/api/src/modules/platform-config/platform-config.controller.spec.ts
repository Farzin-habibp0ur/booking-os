import { PlatformConfigController } from './platform-config.controller';
import { PlatformConfigService } from './platform-config.service';

describe('PlatformConfigController', () => {
  let controller: PlatformConfigController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn(),
      update: jest.fn(),
      getPublishingWindows: jest.fn(),
    };
    controller = new PlatformConfigController(mockService as unknown as PlatformConfigService);
  });

  it('findAll delegates to service with businessId', async () => {
    mockService.findAll.mockResolvedValue([{ platform: 'INSTAGRAM', enabled: true }]);

    const result = await controller.findAll('biz1');

    expect(mockService.findAll).toHaveBeenCalledWith('biz1');
    expect(result).toEqual([{ platform: 'INSTAGRAM', enabled: true }]);
  });

  it('update delegates to service with businessId, platform, and dto', async () => {
    const dto = { enabled: false } as any;
    mockService.update.mockResolvedValue({ platform: 'INSTAGRAM', enabled: false });

    const result = await controller.update('biz1', 'INSTAGRAM', dto);

    expect(mockService.update).toHaveBeenCalledWith('biz1', 'INSTAGRAM', dto);
    expect(result).toEqual({ platform: 'INSTAGRAM', enabled: false });
  });

  it('getPublishingWindows delegates to service with businessId', async () => {
    mockService.getPublishingWindows.mockResolvedValue([
      { day: 'MONDAY', startHour: 9, endHour: 17 },
    ]);

    const result = await controller.getPublishingWindows('biz1');

    expect(mockService.getPublishingWindows).toHaveBeenCalledWith('biz1');
    expect(result).toEqual([{ day: 'MONDAY', startHour: 9, endHour: 17 }]);
  });
});
