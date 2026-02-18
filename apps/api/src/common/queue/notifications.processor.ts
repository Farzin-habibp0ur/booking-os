import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';

export interface NotificationJobData {
  to: string;
  subject: string;
  html: string;
}

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { to, subject, html } = job.data;
    this.logger.log(`Processing notification job ${job.id} to ${to}`);

    const { EmailService } = await import('../../modules/email/email.service');
    const emailService = (this as any).moduleRef?.get(EmailService);

    if (!emailService) {
      throw new Error('EmailService not available — cannot process job');
    }

    try {
      await emailService.send({ to, subject, html });
    } catch (err) {
      this.logger.error(
        `Notification job ${job.id} failed for ${to}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
