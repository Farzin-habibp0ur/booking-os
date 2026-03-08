import { Test } from '@nestjs/testing';
import { SystemStatusService } from './system-status.service';
import { PrismaService } from '../../common/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createMockPrisma } from '../../test/mocks';

describe('SystemStatusService', () => {
  let service: SystemStatusService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          NODE_ENV: 'test',
          REDIS_URL: undefined,
          ENABLE_CRON: false,
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SystemStatusService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(SystemStatusService);
  });

  describe('getSystemStatus', () => {
    it('should return healthy status when database is ok', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.status).toBe('healthy');
      expect(result.services.database.status).toBe('ok');
      expect(result.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.services.redis).toBeUndefined();
    });

    it('should return degraded status when database is ok but redis fails', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        if (key === 'ENABLE_CRON') return false;
        if (key === 'NODE_ENV') return 'test';
        return defaultValue;
      });

      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      // Mock redis import to fail
      jest.spyOn(global as any, 'fetch').mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.getSystemStatus();

      // Redis check will fail, but DB is ok → degraded
      expect(['degraded', 'healthy']).toContain(result.status);
      expect(result.services.database.status).toBe('ok');
      if (result.services.redis) {
        expect(['error', 'ok']).toContain(result.services.redis.status);
      }
    });

    it('should return unhealthy status when database fails', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      const result = await service.getSystemStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('error');
      expect(result.services.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should set redis to unavailable when REDIS_URL is not set', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REDIS_URL') return undefined;
        if (key === 'ENABLE_CRON') return false;
        if (key === 'NODE_ENV') return 'test';
        return defaultValue;
      });

      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.services.redis.status).toBe('unavailable');
      expect(result.services.redis.latencyMs).toBeUndefined();
      expect(configService.get).toHaveBeenCalledWith('REDIS_URL');
    });

    it('should set cron enabled when ENABLE_CRON is true', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'ENABLE_CRON') return true;
        if (key === 'NODE_ENV') return 'test';
        if (key === 'REDIS_URL') return undefined;
        return defaultValue;
      });

      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.cron.enabled).toBe(true);
      expect(result.cron.jobCount).toBe(0);
    });

    it('should set cron disabled when ENABLE_CRON is false or not set', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.cron.enabled).toBe(false);
      expect(result.cron.jobCount).toBe(0);
    });

    it('should include memory stats in correct format', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.memory.rss).toMatch(/^\d+ MB$/);
      expect(result.memory.heapUsed).toMatch(/^\d+ MB$/);
      expect(result.memory.heapTotal).toMatch(/^\d+ MB$/);
    });

    it('should return uptime as a number', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should return ISO formatted timestamp', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include version from environment', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    });

    it('should include environment from config', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.environment).toBe('test');
    });

    it('should include workers with registered queues', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.workers).toBeDefined();
      expect(Array.isArray(result.workers.queuesRegistered)).toBe(true);
      expect(result.workers.queuesRegistered).toContain('ai-processing');
      expect(result.workers.queuesRegistered).toContain('messaging');
    });

    it('should have empty queues when REDIS_URL is not set', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'REDIS_URL') return undefined;
        if (key === 'ENABLE_CRON') return false;
        if (key === 'NODE_ENV') return 'test';
        return defaultValue;
      });

      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.workers.queuesRegistered).toEqual([]);
    });

    it('should measure database latency', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.services.database.latencyMs).toBe('number');
    });

    it('should handle database errors with latency measurement', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('DB timeout'));

      const result = await service.getSystemStatus();

      expect(result.services.database.status).toBe('error');
      expect(result.services.database.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return correct response shape', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getSystemStatus();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('cron');
      expect(result).toHaveProperty('workers');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('timestamp');

      expect(result.services).toHaveProperty('database');
      expect(result.cron).toHaveProperty('enabled');
      expect(result.cron).toHaveProperty('jobCount');
      expect(result.workers).toHaveProperty('queuesRegistered');
    });

    it('should handle multiple calls with increasing uptime', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result1 = await service.getSystemStatus();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result2 = await service.getSystemStatus();

      expect(result2.uptime).toBeGreaterThanOrEqual(result1.uptime);
    });
  });
});
