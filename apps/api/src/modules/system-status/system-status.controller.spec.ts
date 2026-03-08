import { Test } from '@nestjs/testing';
import { SystemStatusController } from './system-status.controller';
import { SystemStatusService } from './system-status.service';

describe('SystemStatusController', () => {
  let controller: SystemStatusController;
  let systemStatusService: {
    getSystemStatus: jest.Mock;
  };

  beforeEach(async () => {
    systemStatusService = {
      getSystemStatus: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [SystemStatusController],
      providers: [
        {
          provide: SystemStatusService,
          useValue: systemStatusService,
        },
      ],
    }).compile();

    controller = module.get(SystemStatusController);
  });

  describe('getSystemStatus', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
      expect(controller.getSystemStatus).toBeDefined();
    });

    it('should return status from service', async () => {
      const mockStatus = {
        status: 'healthy',
        uptime: 3600,
        version: '0.1.0',
        environment: 'test',
        services: {
          database: { status: 'ok', latencyMs: 5 },
          redis: { status: 'ok', latencyMs: 2 },
        },
        cron: {
          enabled: true,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: ['ai-processing', 'messaging'],
        },
        memory: {
          rss: '120 MB',
          heapUsed: '85 MB',
          heapTotal: '130 MB',
        },
        timestamp: '2026-03-06T12:34:56.789Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(result).toEqual(mockStatus);
      expect(systemStatusService.getSystemStatus).toHaveBeenCalledTimes(1);
    });

    it('should return correct response shape', async () => {
      const mockStatus = {
        status: 'healthy',
        uptime: 3600,
        version: '0.1.0',
        environment: 'test',
        services: {
          database: { status: 'ok', latencyMs: 5 },
        },
        cron: {
          enabled: false,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: [],
        },
        memory: {
          rss: '100 MB',
          heapUsed: '50 MB',
          heapTotal: '100 MB',
        },
        timestamp: '2026-03-06T12:00:00.000Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

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
      expect(result.memory).toHaveProperty('rss');
      expect(result.memory).toHaveProperty('heapUsed');
      expect(result.memory).toHaveProperty('heapTotal');
    });

    it('should handle degraded status', async () => {
      const mockStatus = {
        status: 'degraded',
        uptime: 1800,
        version: '0.1.0',
        environment: 'production',
        services: {
          database: { status: 'ok', latencyMs: 10 },
          redis: { status: 'error', latencyMs: 5000 },
        },
        cron: {
          enabled: true,
          jobCount: 5,
        },
        workers: {
          queuesRegistered: ['ai-processing', 'messaging'],
        },
        memory: {
          rss: '150 MB',
          heapUsed: '100 MB',
          heapTotal: '150 MB',
        },
        timestamp: '2026-03-06T13:00:00.000Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(result.status).toBe('degraded');
      expect(result.services.database.status).toBe('ok');
      expect(result.services.redis.status).toBe('error');
    });

    it('should handle unhealthy status', async () => {
      const mockStatus = {
        status: 'unhealthy',
        uptime: 900,
        version: '0.1.0',
        environment: 'staging',
        services: {
          database: { status: 'error', latencyMs: 30000 },
          redis: { status: 'error', latencyMs: 5000 },
        },
        cron: {
          enabled: false,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: [],
        },
        memory: {
          rss: '200 MB',
          heapUsed: '180 MB',
          heapTotal: '200 MB',
        },
        timestamp: '2026-03-06T14:00:00.000Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.services.database.status).toBe('error');
      expect(result.services.redis.status).toBe('error');
    });

    it('should include redis as unavailable when not configured', async () => {
      const mockStatus = {
        status: 'healthy',
        uptime: 3600,
        version: '0.1.0',
        environment: 'test',
        services: {
          database: { status: 'ok', latencyMs: 5 },
          redis: { status: 'unavailable' },
        },
        cron: {
          enabled: false,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: [],
        },
        memory: {
          rss: '120 MB',
          heapUsed: '85 MB',
          heapTotal: '130 MB',
        },
        timestamp: '2026-03-06T12:34:56.789Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(result.services.redis.status).toBe('unavailable');
      expect(result.services.redis.latencyMs).toBeUndefined();
    });

    it('should return memory stats with proper units', async () => {
      const mockStatus = {
        status: 'healthy',
        uptime: 3600,
        version: '0.1.0',
        environment: 'test',
        services: {
          database: { status: 'ok', latencyMs: 5 },
        },
        cron: {
          enabled: false,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: [],
        },
        memory: {
          rss: '256 MB',
          heapUsed: '128 MB',
          heapTotal: '256 MB',
        },
        timestamp: '2026-03-06T12:34:56.789Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(result.memory.rss).toMatch(/^\d+ MB$/);
      expect(result.memory.heapUsed).toMatch(/^\d+ MB$/);
      expect(result.memory.heapTotal).toMatch(/^\d+ MB$/);
    });

    it('should return numeric uptime value', async () => {
      const mockStatus = {
        status: 'healthy',
        uptime: 7200,
        version: '0.1.0',
        environment: 'test',
        services: {
          database: { status: 'ok', latencyMs: 5 },
        },
        cron: {
          enabled: false,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: [],
        },
        memory: {
          rss: '120 MB',
          heapUsed: '85 MB',
          heapTotal: '130 MB',
        },
        timestamp: '2026-03-06T12:34:56.789Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should return ISO formatted timestamp', async () => {
      const mockStatus = {
        status: 'healthy',
        uptime: 3600,
        version: '0.1.0',
        environment: 'test',
        services: {
          database: { status: 'ok', latencyMs: 5 },
        },
        cron: {
          enabled: false,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: [],
        },
        memory: {
          rss: '120 MB',
          heapUsed: '85 MB',
          heapTotal: '130 MB',
        },
        timestamp: '2026-03-06T12:34:56.789Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it('should return cron info with job count', async () => {
      const mockStatus = {
        status: 'healthy',
        uptime: 3600,
        version: '0.1.0',
        environment: 'test',
        services: {
          database: { status: 'ok', latencyMs: 5 },
        },
        cron: {
          enabled: true,
          jobCount: 3,
        },
        workers: {
          queuesRegistered: [],
        },
        memory: {
          rss: '120 MB',
          heapUsed: '85 MB',
          heapTotal: '130 MB',
        },
        timestamp: '2026-03-06T12:34:56.789Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(result.cron.enabled).toBe(true);
      expect(typeof result.cron.jobCount).toBe('number');
      expect(result.cron.jobCount).toBe(3);
    });

    it('should return array of registered queues', async () => {
      const mockStatus = {
        status: 'healthy',
        uptime: 3600,
        version: '0.1.0',
        environment: 'test',
        services: {
          database: { status: 'ok', latencyMs: 5 },
        },
        cron: {
          enabled: true,
          jobCount: 0,
        },
        workers: {
          queuesRegistered: ['ai-processing', 'messaging', 'notifications'],
        },
        memory: {
          rss: '120 MB',
          heapUsed: '85 MB',
          heapTotal: '130 MB',
        },
        timestamp: '2026-03-06T12:34:56.789Z',
      };

      systemStatusService.getSystemStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSystemStatus();

      expect(Array.isArray(result.workers.queuesRegistered)).toBe(true);
      expect(result.workers.queuesRegistered).toContain('ai-processing');
      expect(result.workers.queuesRegistered).toContain('messaging');
      expect(result.workers.queuesRegistered).toContain('notifications');
    });
  });
});
