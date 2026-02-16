import { HealthController } from './health.controller';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: MockPrisma;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrisma();
    configService = { get: jest.fn().mockReturnValue(undefined) };
    controller = new HealthController(prisma as any, configService as any);
  });

  it('returns healthy when database is ok', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('healthy');
    expect(result.checks.database.status).toBe('ok');
    expect(result.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.checks.redis).toBeUndefined();
  });

  it('returns unhealthy when database fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    const result = await controller.check();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.database.status).toBe('error');
  });

  it('includes uptime, version, memory, and timestamp', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await controller.check();

    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.version).toBe('0.1.0');
    expect(result.memory.rss).toMatch(/^\d+ MB$/);
    expect(result.timestamp).toBeDefined();
    expect(() => new Date(result.timestamp)).not.toThrow();
  });

  it('skips redis check when REDIS_URL is not set', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    configService.get.mockReturnValue(undefined);

    const result = await controller.check();

    expect(result.checks.redis).toBeUndefined();
    expect(configService.get).toHaveBeenCalledWith('REDIS_URL');
  });

  it('returns degraded when database is ok but redis fails', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    configService.get.mockReturnValue('redis://localhost:6379');

    // Redis import will fail in test environment (no redis server)
    const result = await controller.check();

    // Redis check attempted but failed → degraded (db ok, redis error)
    expect(result.status).toBe('degraded');
    expect(result.checks.database.status).toBe('ok');
    expect(result.checks.redis.status).toBe('error');
  });

  it('returns unhealthy when both database and redis fail', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB down'));
    configService.get.mockReturnValue('redis://localhost:6379');

    const result = await controller.check();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.database.status).toBe('error');
    expect(result.checks.redis.status).toBe('error');
  });
});
