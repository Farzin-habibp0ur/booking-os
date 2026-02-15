import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, { status: string; latencyMs: number }> = {};

    // Database check
    const dbStart = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'ok', latencyMs: Math.round(performance.now() - dbStart) };
    } catch {
      checks.database = { status: 'error', latencyMs: Math.round(performance.now() - dbStart) };
    }

    // Redis check (conditional)
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      const redisStart = performance.now();
      try {
        const { createClient } = await import('redis');
        const client = createClient({ url: redisUrl });
        await client.connect();
        await client.ping();
        await client.disconnect();
        checks.redis = { status: 'ok', latencyMs: Math.round(performance.now() - redisStart) };
      } catch {
        checks.redis = { status: 'error', latencyMs: Math.round(performance.now() - redisStart) };
      }
    }

    // Determine overall status
    const statuses = Object.values(checks).map((c) => c.status);
    const allOk = statuses.every((s) => s === 'ok');
    const allError = statuses.every((s) => s === 'error');
    let status: string;
    if (allOk) status = 'healthy';
    else if (allError) status = 'unhealthy';
    else status = 'degraded';

    const mem = process.memoryUsage();

    return {
      status,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '0.1.0',
      checks,
      memory: { rss: `${Math.round(mem.rss / 1024 / 1024)} MB` },
      timestamp: new Date().toISOString(),
    };
  }
}
