import { Test } from '@nestjs/testing';
import { ConsoleSettingsController } from './console-settings.controller';
import { ConsoleSettingsService } from './console-settings.service';
import { PlatformAuditService } from './platform-audit.service';

describe('ConsoleSettingsController', () => {
  let controller: ConsoleSettingsController;
  let settingsService: jest.Mocked<ConsoleSettingsService>;
  let auditService: jest.Mocked<PlatformAuditService>;

  const mockUser = { sub: 'admin1', email: 'admin@test.com' };

  beforeEach(async () => {
    const mockSettingsService = {
      getAllSettings: jest.fn(),
      getSetting: jest.fn(),
      updateSetting: jest.fn(),
      bulkUpdate: jest.fn(),
      resetSetting: jest.fn(),
    };

    const mockAuditService = {
      log: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [ConsoleSettingsController],
      providers: [
        { provide: ConsoleSettingsService, useValue: mockSettingsService },
        { provide: PlatformAuditService, useValue: mockAuditService },
      ],
    }).compile();

    controller = module.get(ConsoleSettingsController);
    settingsService = module.get(ConsoleSettingsService);
    auditService = module.get(PlatformAuditService);
  });

  it('getAllSettings delegates to service and logs audit', async () => {
    const mockResult = { security: [], notifications: [], regional: [], platform: [] };
    settingsService.getAllSettings.mockResolvedValue(mockResult as any);

    const result = await controller.getAllSettings(mockUser);

    expect(result).toEqual(mockResult);
    expect(settingsService.getAllSettings).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith('admin1', 'admin@test.com', 'SETTINGS_VIEW');
  });

  it('getSetting delegates to service', async () => {
    const mockResult = { key: 'security.sessionTimeoutMins', value: 60, isDefault: true };
    settingsService.getSetting.mockResolvedValue(mockResult);

    const result = await controller.getSetting('security.sessionTimeoutMins', mockUser);

    expect(result).toEqual(mockResult);
    expect(settingsService.getSetting).toHaveBeenCalledWith('security.sessionTimeoutMins');
  });

  it('updateSetting delegates to service and logs audit', async () => {
    const mockResult = { key: 'security.sessionTimeoutMins', value: 90, isDefault: false };
    settingsService.updateSetting.mockResolvedValue(mockResult);

    const result = await controller.updateSetting(
      'security.sessionTimeoutMins',
      { value: 90 },
      mockUser,
    );

    expect(result).toEqual(mockResult);
    expect(settingsService.updateSetting).toHaveBeenCalledWith(
      'security.sessionTimeoutMins',
      90,
      'admin1',
    );
    expect(auditService.log).toHaveBeenCalledWith('admin1', 'admin@test.com', 'SETTING_UPDATE', {
      targetType: 'SETTING',
      targetId: 'security.sessionTimeoutMins',
      metadata: { value: 90 },
    });
  });

  it('bulkUpdate delegates to service and logs audit with keys', async () => {
    const mockResult = [
      { key: 'security.sessionTimeoutMins', value: 90, isDefault: false },
      { key: 'platform.maintenanceMode', value: true, isDefault: false },
    ];
    settingsService.bulkUpdate.mockResolvedValue(mockResult);

    const dto = {
      settings: [
        { key: 'security.sessionTimeoutMins', value: 90 },
        { key: 'platform.maintenanceMode', value: true },
      ],
    };

    const result = await controller.bulkUpdate(dto, mockUser);

    expect(result).toEqual(mockResult);
    expect(settingsService.bulkUpdate).toHaveBeenCalledWith(dto.settings, 'admin1');
    expect(auditService.log).toHaveBeenCalledWith(
      'admin1',
      'admin@test.com',
      'SETTINGS_BULK_UPDATE',
      {
        metadata: { keys: ['security.sessionTimeoutMins', 'platform.maintenanceMode'] },
      },
    );
  });

  it('resetSetting delegates to service and logs audit', async () => {
    const mockResult = { key: 'security.sessionTimeoutMins', value: 60, isDefault: true };
    settingsService.resetSetting.mockResolvedValue(mockResult);

    const result = await controller.resetSetting('security.sessionTimeoutMins', mockUser);

    expect(result).toEqual(mockResult);
    expect(settingsService.resetSetting).toHaveBeenCalledWith(
      'security.sessionTimeoutMins',
      'admin1',
    );
    expect(auditService.log).toHaveBeenCalledWith('admin1', 'admin@test.com', 'SETTING_RESET', {
      targetType: 'SETTING',
      targetId: 'security.sessionTimeoutMins',
    });
  });
});
