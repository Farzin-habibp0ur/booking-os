import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';
import type { DripJobData } from '../../modules/onboarding-drip/onboarding-drip.service';

@Processor(QUEUE_NAMES.ONBOARDING_DRIP)
export class OnboardingDripProcessor extends WorkerHost {
  private readonly logger = new Logger(OnboardingDripProcessor.name);

  async process(job: Job<DripJobData>): Promise<void> {
    this.logger.log(
      `Processing drip step ${job.data.step} for ${job.data.email} (business ${job.data.businessId})`,
    );

    const { OnboardingDripService } =
      await import('../../modules/onboarding-drip/onboarding-drip.service');
    const dripService = (this as any).moduleRef?.get(OnboardingDripService);

    if (!dripService) {
      throw new Error('OnboardingDripService not available — cannot process job');
    }

    try {
      await dripService.sendDripEmail(job.data);
    } catch (err) {
      this.logger.error(
        `Drip job ${job.id} failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
