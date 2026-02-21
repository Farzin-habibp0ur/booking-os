import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@booking-os/db';

/**
 * Build a DATABASE_URL with connection pool limits and statement_timeout
 * applied to ALL pooled connections (not just one session).
 */
function buildDatasourceUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  try {
    const url = new URL(base);

    // Prisma pool params (override if not already set)
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '10');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '10');
    }

    // PostgreSQL statement_timeout via connection options — applies to every
    // connection in the pool, preventing any single query from hanging.
    const existing = url.searchParams.get('options') || '';
    if (!existing.includes('statement_timeout')) {
      const opt = existing
        ? `${existing} -c statement_timeout=30000`
        : '-c statement_timeout=30000';
      url.searchParams.set('options', opt);
    }

    const finalUrl = url.toString();
    // Log the config (without password) for debugging
    const safeUrl = finalUrl.replace(/:([^:@]+)@/, ':***@');
    console.log(`[PrismaService] Using DATABASE_URL with pool config: ${safeUrl}`);
    return finalUrl;
  } catch (err) {
    // If URL parsing fails, fall back to the original URL
    console.error('[PrismaService] Failed to parse DATABASE_URL, using as-is:', err);
    return base;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: buildDatasourceUrl(),
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
