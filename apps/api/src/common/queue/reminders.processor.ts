import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';

export interface ReminderJobData {
  reminderId: string;
}

@Processor(QUEUE_NAMES.REMINDERS)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { reminderId } = job.data;
    this.logger.log(`Processing reminder job ${job.id} for reminder ${reminderId}`);

    const { ReminderService } = await import('../../modules/reminder/reminder.service');
    const reminderService = (this as any).moduleRef?.get(ReminderService);

    if (!reminderService) {
      this.logger.warn('ReminderService not available — skipping job');
      return;
    }

    await reminderService.processPendingReminders();
  }
}
