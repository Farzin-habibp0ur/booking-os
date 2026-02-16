import { Module, Global, Logger, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

export const QUEUE_NAMES = {
  AI_PROCESSING: 'ai-processing',
  MESSAGING: 'messaging',
  REMINDERS: 'reminders',
  NOTIFICATIONS: 'notifications',
  CALENDAR_SYNC: 'calendar-sync',
} as const;

@Global()
@Module({})
export class QueueModule {
  private static readonly logger = new Logger('QueueModule');

  static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'QUEUE_AVAILABLE',
          useFactory: (config: ConfigService) => {
            const redisUrl = config.get<string>('REDIS_URL');
            if (redisUrl) {
              QueueModule.logger.log('Redis connected — BullMQ queues active');
              return true;
            }
            QueueModule.logger.log(
              'No REDIS_URL — using fire-and-forget async (ok for <50 clients)',
            );
            return false;
          },
          inject: [ConfigService],
        },
      ],
      exports: ['QUEUE_AVAILABLE'],
    };
  }

  static forRootWithRedis(): DynamicModule {
    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              url: config.get<string>('REDIS_URL'),
            },
          }),
        }),
        BullModule.registerQueue(
          { name: QUEUE_NAMES.AI_PROCESSING },
          { name: QUEUE_NAMES.MESSAGING },
          { name: QUEUE_NAMES.REMINDERS },
          { name: QUEUE_NAMES.NOTIFICATIONS },
          { name: QUEUE_NAMES.CALENDAR_SYNC },
        ),
      ],
      providers: [
        {
          provide: 'QUEUE_AVAILABLE',
          useValue: true,
        },
      ],
      exports: ['QUEUE_AVAILABLE', BullModule],
    };
  }
}
