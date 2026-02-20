import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConsoleSettingsService, SETTING_DEFAULTS } from './console-settings.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleSettingsService', () => {
  let service: ConsoleSettingsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [ConsoleSettingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ConsoleSettingsService);
  });

  describe('getAllSettings', () => {
    it('returns all settings grouped by category with defaults', async () => {
      prisma.platformSetting.findMany.mockResolvedValue([]);

      const result = await service.getAllSettings();

      expect(result).toHaveProperty('security');
      expect(result).toHaveProperty('notifications');
      expect(result).toHaveProperty('regional');
      expect(result).toHaveProperty('platform');
      expect(result.security).toHaveLength(4);
      expect(result.notifications).toHaveLength(3);
      expect(result.regional).toHaveLength(3);
      expect(result.platform).toHaveLength(3);
    });

    it('uses defaults when no stored settings exist', async () => {
      prisma.platformSetting.findMany.mockResolvedValue([]);

      const result = await service.getAllSettings();

      const sessionTimeout = result.security.find(
        (s: any) => s.key === 'security.sessionTimeoutMins',
      );
      expect(sessionTimeout).toEqual({
        key: 'security.sessionTimeoutMins',
        value: 60,
        isDefault: true,
      });
    });

    it('uses stored value when setting exists in DB', async () => {
      prisma.platformSetting.findMany.mockResolvedValue([
        {
          id: '1',
          key: 'security.sessionTimeoutMins',
          value: 120,
          updatedAt: new Date(),
          updatedBy: 'admin1',
        },
      ] as any);

      const result = await service.getAllSettings();

      const sessionTimeout = result.security.find(
        (s: any) => s.key === 'security.sessionTimeoutMins',
      );
      expect(sessionTimeout).toEqual({
        key: 'security.sessionTimeoutMins',
        value: 120,
        isDefault: false,
      });
    });
  });

  describe('getSetting', () => {
    it('returns default value when not stored', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue(null);

      const result = await service.getSetting('security.sessionTimeoutMins');

      expect(result).toEqual({
        key: 'security.sessionTimeoutMins',
        value: 60,
        isDefault: true,
      });
    });

    it('returns stored value when exists', async () => {
      prisma.platformSetting.findUnique.mockResolvedValue({
        id: '1',
        key: 'security.sessionTimeoutMins',
        value: 90,
        updatedAt: new Date(),
        updatedBy: 'admin1',
      } as any);

      const result = await service.getSetting('security.sessionTimeoutMins');

      expect(result).toEqual({
        key: 'security.sessionTimeoutMins',
        value: 90,
        isDefault: false,
      });
    });

    it('throws NotFoundException for unknown key', async () => {
      await expect(service.getSetting('unknown.key')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSetting', () => {
    it('persists a valid number setting', async () => {
      prisma.platformSetting.upsert.mockResolvedValue({
        id: '1',
        key: 'security.sessionTimeoutMins',
        value: 90,
        updatedAt: new Date(),
        updatedBy: 'admin1',
      } as any);

      const result = await service.updateSetting('security.sessionTimeoutMins', 90, 'admin1');

      expect(result).toEqual({
        key: 'security.sessionTimeoutMins',
        value: 90,
        isDefault: false,
      });
      expect(prisma.platformSetting.upsert).toHaveBeenCalledWith({
        where: { key: 'security.sessionTimeoutMins' },
        update: { value: 90, updatedBy: 'admin1' },
        create: { key: 'security.sessionTimeoutMins', value: 90, updatedBy: 'admin1' },
      });
    });

    it('persists a valid boolean setting', async () => {
      prisma.platformSetting.upsert.mockResolvedValue({
        id: '1',
        key: 'security.requireEmailVerification',
        value: false,
        updatedAt: new Date(),
        updatedBy: 'admin1',
      } as any);

      const result = await service.updateSetting(
        'security.requireEmailVerification',
        false,
        'admin1',
      );

      expect(result.value).toBe(false);
    });

    it('rejects wrong type for number setting', async () => {
      await expect(
        service.updateSetting('security.sessionTimeoutMins', 'not-a-number', 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects wrong type for boolean setting', async () => {
      await expect(
        service.updateSetting('security.requireEmailVerification', 'yes', 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects number below min', async () => {
      await expect(
        service.updateSetting('security.sessionTimeoutMins', 1, 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects number above max', async () => {
      await expect(
        service.updateSetting('security.sessionTimeoutMins', 9999, 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for unknown key', async () => {
      await expect(service.updateSetting('unknown.key', 42, 'admin1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects wrong type for string setting', async () => {
      await expect(
        service.updateSetting('regional.defaultTimezone', 123, 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkUpdate', () => {
    it('validates all settings before persisting', async () => {
      await expect(
        service.bulkUpdate(
          [
            { key: 'security.sessionTimeoutMins', value: 90 },
            { key: 'security.sessionTimeoutMins', value: 'bad' },
          ],
          'admin1',
        ),
      ).rejects.toThrow(BadRequestException);

      // Transaction should not have been called
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('upserts all settings in a transaction', async () => {
      prisma.platformSetting.upsert
        .mockResolvedValueOnce({
          id: '1',
          key: 'security.sessionTimeoutMins',
          value: 90,
          updatedAt: new Date(),
          updatedBy: 'admin1',
        } as any)
        .mockResolvedValueOnce({
          id: '2',
          key: 'platform.maintenanceMode',
          value: true,
          updatedAt: new Date(),
          updatedBy: 'admin1',
        } as any);

      const result = await service.bulkUpdate(
        [
          { key: 'security.sessionTimeoutMins', value: 90 },
          { key: 'platform.maintenanceMode', value: true },
        ],
        'admin1',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('rejects if any key is unknown', async () => {
      await expect(
        service.bulkUpdate(
          [
            { key: 'security.sessionTimeoutMins', value: 90 },
            { key: 'fake.setting', value: 'x' },
          ],
          'admin1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetSetting', () => {
    it('deletes stored value and returns default', async () => {
      prisma.platformSetting.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.resetSetting('security.sessionTimeoutMins', 'admin1');

      expect(result).toEqual({
        key: 'security.sessionTimeoutMins',
        value: 60,
        isDefault: true,
      });
      expect(prisma.platformSetting.deleteMany).toHaveBeenCalledWith({
        where: { key: 'security.sessionTimeoutMins' },
      });
    });

    it('throws NotFoundException for unknown key', async () => {
      await expect(service.resetSetting('unknown.key', 'admin1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('SETTING_DEFAULTS', () => {
    it('has 13 setting keys', () => {
      expect(Object.keys(SETTING_DEFAULTS)).toHaveLength(13);
    });

    it('all keys have a valid type', () => {
      for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
        expect(['number', 'boolean', 'string']).toContain(def.type);
        expect(def.default).toBeDefined();
      }
    });
  });
});
