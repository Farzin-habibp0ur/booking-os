import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

interface SettingDefinition {
  default: unknown;
  type: 'number' | 'boolean' | 'string';
  min?: number;
  max?: number;
  options?: string[];
}

export const SETTING_DEFAULTS: Record<string, SettingDefinition> = {
  'security.sessionTimeoutMins': { default: 60, type: 'number', min: 5, max: 1440 },
  'security.requireEmailVerification': { default: true, type: 'boolean' },
  'security.maxViewAsSessionMins': { default: 15, type: 'number', min: 5, max: 120 },
  'security.maxLoginAttempts': { default: 5, type: 'number', min: 3, max: 20 },
  'notifications.defaultReminderHours': { default: 24, type: 'number', min: 1, max: 168 },
  'notifications.quietHoursStart': { default: '22:00', type: 'string' },
  'notifications.quietHoursEnd': { default: '07:00', type: 'string' },
  'regional.defaultTimezone': { default: 'UTC', type: 'string' },
  'regional.defaultLocale': { default: 'en', type: 'string' },
  'regional.defaultCurrency': { default: 'USD', type: 'string' },
  'platform.maintenanceMode': { default: false, type: 'boolean' },
  'platform.maxTenantsAllowed': { default: 100, type: 'number', min: 1, max: 10000 },
  'platform.apiRateLimitPerMin': { default: 60, type: 'number', min: 10, max: 1000 },
};

@Injectable()
export class ConsoleSettingsService {
  private readonly logger = new Logger(ConsoleSettingsService.name);

  constructor(private prisma: PrismaService) {}

  async getAllSettings() {
    try {
      const stored = await this.prisma.platformSetting.findMany();
      const storedMap = new Map(stored.map((s) => [s.key, s.value]));

      const grouped: Record<string, Array<{ key: string; value: unknown; isDefault: boolean }>> = {};

      for (const [key, def] of Object.entries(SETTING_DEFAULTS)) {
        const category = key.split('.')[0];
        if (!grouped[category]) grouped[category] = [];

        const hasStored = storedMap.has(key);
        grouped[category].push({
          key,
          value: hasStored ? storedMap.get(key) : def.default,
          isDefault: !hasStored,
        });
      }

      return grouped;
    } catch (error) {
      this.logger.error('Failed to get all settings', error);
      throw error;
    }
  }

  async getSetting(key: string) {
    const def = SETTING_DEFAULTS[key];
    if (!def) {
      throw new NotFoundException(`Unknown setting key: ${key}`);
    }

    const stored = await this.prisma.platformSetting.findUnique({ where: { key } });

    return {
      key,
      value: stored ? stored.value : def.default,
      isDefault: !stored,
    };
  }

  async updateSetting(key: string, value: unknown, actorId: string) {
    const def = SETTING_DEFAULTS[key];
    if (!def) {
      throw new NotFoundException(`Unknown setting key: ${key}`);
    }

    this.validateValue(key, value, def);

    const result = await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: value as any, updatedBy: actorId },
      create: { key, value: value as any, updatedBy: actorId },
    });

    return { key: result.key, value: result.value, isDefault: false };
  }

  async bulkUpdate(settings: Array<{ key: string; value: unknown }>, actorId: string) {
    // Validate all first
    for (const s of settings) {
      const def = SETTING_DEFAULTS[s.key];
      if (!def) {
        throw new NotFoundException(`Unknown setting key: ${s.key}`);
      }
      this.validateValue(s.key, s.value, def);
    }

    // Upsert all in a transaction
    const results = await this.prisma.$transaction(
      settings.map((s) =>
        this.prisma.platformSetting.upsert({
          where: { key: s.key },
          update: { value: s.value as any, updatedBy: actorId },
          create: { key: s.key, value: s.value as any, updatedBy: actorId },
        }),
      ),
    );

    return results.map((r) => ({ key: r.key, value: r.value, isDefault: false }));
  }

  async resetSetting(key: string, actorId: string) {
    const def = SETTING_DEFAULTS[key];
    if (!def) {
      throw new NotFoundException(`Unknown setting key: ${key}`);
    }

    await this.prisma.platformSetting.deleteMany({ where: { key } });

    return { key, value: def.default, isDefault: true };
  }

  private validateValue(key: string, value: unknown, def: SettingDefinition) {
    if (def.type === 'number') {
      if (typeof value !== 'number') {
        throw new BadRequestException(`${key} must be a number`);
      }
      if (def.min !== undefined && value < def.min) {
        throw new BadRequestException(`${key} must be at least ${def.min}`);
      }
      if (def.max !== undefined && value > def.max) {
        throw new BadRequestException(`${key} must be at most ${def.max}`);
      }
    } else if (def.type === 'boolean') {
      if (typeof value !== 'boolean') {
        throw new BadRequestException(`${key} must be a boolean`);
      }
    } else if (def.type === 'string') {
      if (typeof value !== 'string') {
        throw new BadRequestException(`${key} must be a string`);
      }
      if (def.options && !def.options.includes(value)) {
        throw new BadRequestException(`${key} must be one of: ${def.options.join(', ')}`);
      }
    }
  }
}
