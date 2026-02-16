import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@booking-os/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          // Connection pooling: Prisma uses DATABASE_URL which can include
          // ?connection_limit=20&pool_timeout=30 for production.
          // For PgBouncer, add &pgbouncer=true to DATABASE_URL.
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    // Set query timeout (30 seconds) to prevent long-running queries
    await this.$executeRawUnsafe('SET statement_timeout = 30000');
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
