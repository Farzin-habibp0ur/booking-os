import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';

export interface MessagingJobData {
  to: string;
  body: string;
  businessId: string;
}

@Processor(QUEUE_NAMES.MESSAGING)
export class MessagingProcessor extends WorkerHost {
  private readonly logger = new Logger(MessagingProcessor.name);

  async process(job: Job<MessagingJobData>): Promise<void> {
    const { to, body, businessId } = job.data;
    this.logger.log(`Sending message job ${job.id} to ${to}`);

    const { MessagingService } = await import('../../modules/messaging/messaging.service');
    const messagingService = (this as any).moduleRef?.get(MessagingService);

    if (!messagingService) {
      throw new Error('MessagingService not available — cannot process job');
    }

    try {
      const provider = messagingService.getProvider();
      await provider.sendMessage({ to, body, businessId });
    } catch (err) {
      this.logger.error(
        `Messaging job ${job.id} failed for ${to}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
