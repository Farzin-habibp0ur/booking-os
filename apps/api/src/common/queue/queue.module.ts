import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Queue module for background job processing.
 *
 * At scale (50+ clients), replace fire-and-forget async calls with BullMQ queues:
 * - AI message processing (webhook controller)
 * - Reminder sending
 * - Stripe webhook processing
 * - WhatsApp message sending with retry
 *
 * Prerequisites:
 * 1. Add Redis to Railway: `railway add --plugin redis`
 * 2. Install BullMQ: `npm install bullmq @nestjs/bullmq --workspace=@booking-os/api`
 * 3. Replace this stub with actual BullMQ configuration
 *
 * Example configuration:
 * ```
 * BullModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     connection: { url: config.get('REDIS_URL') },
 *   }),
 * }),
 * BullModule.registerQueue(
 *   { name: 'ai-processing' },
 *   { name: 'messaging' },
 *   { name: 'reminders' },
 *   { name: 'billing-webhooks' },
 * ),
 * ```
 */
@Global()
@Module({
  providers: [
    {
      provide: 'QUEUE_AVAILABLE',
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          new Logger('QueueModule').log('Redis URL configured — BullMQ ready for initialization');
          return true;
        }
        new Logger('QueueModule').log('No REDIS_URL — using fire-and-forget async (ok for <50 clients)');
        return false;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['QUEUE_AVAILABLE'],
})
export class QueueModule {}
