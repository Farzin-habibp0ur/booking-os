import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

const PLATFORM_DEFAULTS = [
  {
    platform: 'INSTAGRAM',
    phase: 'ACTIVE',
    isEnabled: true,
    postingSchedule: { postsPerWeek: { min: 4, max: 5 } },
    constraints: {
      publishingWindows: {
        days: ['TUE', 'WED', 'THU'],
        times: ['09:00', '12:00', '17:00'],
        timezone: 'UTC-5',
      },
    },
    unlockedAt: new Date('2025-03-17'),
  },
  {
    platform: 'TIKTOK',
    phase: 'ACTIVE',
    isEnabled: true,
    postingSchedule: { postsPerWeek: { min: 5, max: 7 } },
    constraints: {
      publishingWindows: {
        days: ['TUE', 'THU', 'SAT'],
        times: ['07:00', '12:00', '19:00'],
        timezone: 'UTC-5',
      },
    },
    unlockedAt: new Date('2025-03-17'),
  },
  {
    platform: 'LINKEDIN',
    phase: 'ACTIVE',
    isEnabled: true,
    postingSchedule: { postsPerWeek: { min: 3, max: 4 } },
    constraints: {
      publishingWindows: {
        days: ['TUE', 'WED', 'THU'],
        times: ['07:30', '12:00', '17:30'],
        timezone: 'UTC-5',
      },
    },
    unlockedAt: new Date('2025-03-17'),
  },
  {
    platform: 'YOUTUBE',
    phase: 'LOCKED',
    isEnabled: false,
    postingSchedule: { postsPerWeek: { min: 1, max: 2 } },
    constraints: {
      publishingWindows: {
        days: ['THU', 'FRI', 'SAT'],
        times: ['14:00', '17:00'],
        timezone: 'UTC-5',
      },
    },
    unlockedAt: null,
  },
  {
    platform: 'PINTEREST',
    phase: 'LOCKED',
    isEnabled: false,
    postingSchedule: { postsPerWeek: { min: 5, max: 7 } },
    constraints: {
      publishingWindows: {
        days: ['FRI', 'SAT'],
        times: ['20:00', '21:00'],
        timezone: 'UTC-5',
      },
    },
    unlockedAt: null,
  },
  {
    platform: 'TWITTER',
    phase: 'LOCKED',
    isEnabled: false,
    postingSchedule: { postsPerWeek: { min: 3, max: 5 } },
    constraints: {
      publishingWindows: {
        days: ['MON', 'WED', 'FRI'],
        times: ['08:00', '12:00', '18:00'],
        timezone: 'UTC-5',
      },
    },
    unlockedAt: null,
  },
];

const PHASE_ORDER = ['LOCKED', 'ACTIVE', 'SCALING'];

@Injectable()
export class PlatformConfigService {
  constructor(private prisma: PrismaService) {}

  async seedDefaults(businessId: string): Promise<number> {
    let created = 0;
    for (const def of PLATFORM_DEFAULTS) {
      const existing = await this.prisma.platformConfig.findUnique({
        where: { businessId_platform: { businessId, platform: def.platform } },
      });
      if (!existing) {
        await this.prisma.platformConfig.create({
          data: {
            businessId,
            platform: def.platform,
            phase: def.phase,
            isEnabled: def.isEnabled,
            postingSchedule: def.postingSchedule,
            constraints: def.constraints,
            unlockedAt: def.unlockedAt,
          },
        });
        created++;
      }
    }
    return created;
  }

  async findAll(businessId: string) {
    const configs = await this.prisma.platformConfig.findMany({
      where: { businessId },
      orderBy: { platform: 'asc' },
    });

    if (configs.length === 0) {
      await this.seedDefaults(businessId);
      return this.prisma.platformConfig.findMany({
        where: { businessId },
        orderBy: { platform: 'asc' },
      });
    }

    return configs;
  }

  async update(businessId: string, platform: string, data: Record<string, any>) {
    const config = await this.prisma.platformConfig.findUnique({
      where: { businessId_platform: { businessId, platform } },
    });
    if (!config) throw new NotFoundException(`Platform config for ${platform} not found`);

    if (data.phase) {
      const currentIdx = PHASE_ORDER.indexOf(config.phase);
      const newIdx = PHASE_ORDER.indexOf(data.phase);
      if (newIdx < currentIdx) {
        throw new BadRequestException('Cannot re-lock a platform. Phases can only move forward.');
      }
    }

    return this.prisma.platformConfig.update({
      where: { businessId_platform: { businessId, platform } },
      data: {
        ...(data.phase && { phase: data.phase }),
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.credentials && { credentials: data.credentials }),
        ...(data.postingSchedule && { postingSchedule: data.postingSchedule }),
        ...(data.constraints && { constraints: data.constraints }),
        ...(data.metrics && { metrics: data.metrics }),
        ...(data.metadata && { metadata: data.metadata }),
        ...(data.phase &&
          data.phase !== 'LOCKED' &&
          !config.unlockedAt && { unlockedAt: new Date() }),
      },
    });
  }

  async getPublishingWindows(businessId: string) {
    const configs = await this.prisma.platformConfig.findMany({
      where: { businessId, phase: { not: 'LOCKED' }, isEnabled: true },
    });

    return configs.map((c) => {
      const constraints = c.constraints as any;
      return {
        platform: c.platform,
        phase: c.phase,
        windows: constraints?.publishingWindows ?? null,
        postsPerWeek: (c.postingSchedule as any)?.postsPerWeek ?? null,
      };
    });
  }
}
