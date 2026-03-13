import { AutonomySettingsController } from './autonomy-settings.controller';
import { AutonomySettingsService } from './autonomy-settings.service';

describe('AutonomySettingsController', () => {
  let controller: AutonomySettingsController;
  let mockService: Record<string, jest.Mock>;

  beforeEach(() => {
    mockService = {
      findAll: jest.fn(),
      update: jest.fn(),
      resetToDefaults: jest.fn(),
    };
    controller = new AutonomySettingsController(
      mockService as unknown as AutonomySettingsService,
    );
  });

  it('findAll delegates to service with businessId', async () => {
    mockService.findAll.mockResolvedValue([{ actionType: 'SEND_REMINDER', level: 'SUGGEST' }]);

    const result = await controller.findAll('biz1');

    expect(mockService.findAll).toHaveBeenCalledWith('biz1');
    expect(result).toEqual([{ actionType: 'SEND_REMINDER', level: 'SUGGEST' }]);
  });

  it('update delegates to service with businessId, actionType, and dto.level', async () => {
    const dto = { level: 'AUTO' } as any;
    mockService.update.mockResolvedValue({ actionType: 'SEND_REMINDER', level: 'AUTO' });

    const result = await controller.update('biz1', 'SEND_REMINDER', dto);

    expect(mockService.update).toHaveBeenCalledWith('biz1', 'SEND_REMINDER', 'AUTO');
    expect(result).toEqual({ actionType: 'SEND_REMINDER', level: 'AUTO' });
  });

  it('reset delegates to service.resetToDefaults with businessId', async () => {
    mockService.resetToDefaults.mockResolvedValue({ reset: true });

    const result = await controller.reset('biz1');

    expect(mockService.resetToDefaults).toHaveBeenCalledWith('biz1');
    expect(result).toEqual({ reset: true });
  });
});
