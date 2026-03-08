import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';
import type {
  DunningJobData,
  DunningDowngradeJobData,
} from '../../modules/dunning/dunning.service';

@Processor(QUEUE_NAMES.DUNNING)
export class DunningProcessor extends WorkerHost {
  private readonly logger = new Logger(DunningProcessor.name);

  async process(job: Job<DunningJobData | DunningDowngradeJobData>): Promise<void> {
    const { DunningService } = await import('../../modules/dunning/dunning.service');
    const dunningService = (this as any).moduleRef?.get(DunningService);

    if (!dunningService) {
      throw new Error('DunningService not available — cannot process job');
    }

    try {
      if (job.name === 'dunning-downgrade') {
        this.logger.log(`Processing dunning downgrade for business ${(job.data as DunningDowngradeJobData).businessId}`);
        await dunningService.processDowngrade(job.data as DunningDowngradeJobData);
      } else {
        const data = job.data as DunningJobData;
        this.logger.log(
          `Processing dunning step ${data.step} for ${data.email} (business ${data.businessId})`,
        );
        await dunningService.sendDunningEmail(data);
      }
    } catch (err) {
      this.logger.error(
        `Dunning job ${job.id} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
