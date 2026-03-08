import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';

interface ServiceCheck {
  status: 'ok' | 'error' | 'unavailable';
  latencyMs?: number;
}

interface SystemStatusResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceCheck;
    redis?: ServiceCheck;
  };
  cron: {
    enabled: boolean;
    jobCount: number;
  };
  workers: {
    queuesRegistered: string[];
  };
  memory: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
  timestamp: string;
}

@Injectable()
export class SystemStatusService {
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getSystemStatus(): Promise<SystemStatusResponse> {
    const checks: Record<string, ServiceCheck> = {};

    // Database check
    const dbStart = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'ok',
        latencyMs: Math.round(performance.now() - dbStart),
      };
    } catch {
      checks.database = {
        status: 'error',
        latencyMs: Math.round(performance.now() - dbStart),
      };
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
        checks.redis = {
          status: 'ok',
          latencyMs: Math.round(performance.now() - redisStart),
        };
      } catch {
        checks.redis = {
          status: 'error',
          latencyMs: Math.round(performance.now() - redisStart),
        };
      }
    } else {
      checks.redis = { status: 'unavailable' };
    }

    // Determine overall status
    const activeChecks = Object.values(checks).filter(
      (c) => c.status !== 'unavailable',
    );
    const statuses = activeChecks.map((c) => c.status);
    const allOk = statuses.every((s) => s === 'ok');
    const allError = statuses.every((s) => s === 'error');
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (allOk) status = 'healthy';
    else if (allError) status = 'unhealthy';
    else status = 'degraded';

    // Get cron configuration
    const cronEnabled = this.config.get<boolean>('ENABLE_CRON', false);

    // Get queues if Redis is available
    const queuesRegistered = redisUrl
      ? this.getRegisteredQueues()
      : [];

    // Get memory information
    const mem = process.memoryUsage();

    return {
      status,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '0.1.0',
      environment: this.config.get<string>('NODE_ENV', 'development'),
      services: {
        database: checks.database,
        ...(redisUrl && { redis: checks.redis }),
      },
      cron: {
        enabled: cronEnabled,
        jobCount: cronEnabled ? this.getJobCount() : 0,
      },
      workers: {
        queuesRegistered,
      },
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)} MB`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private getRegisteredQueues(): string[] {
    // Return list of registered queue names
    // This can be expanded to actually query the queue system
    return ['ai-processing', 'messaging'];
  }

  private getJobCount(): number {
    // Return count of scheduled cron jobs
    // This can be expanded to actually query cron jobs if using a cron library
    return 0;
  }
}
