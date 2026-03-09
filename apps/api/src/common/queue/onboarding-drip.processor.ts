import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';
import type { DripJobData } from '../../modules/onboarding-drip/onboarding-drip.service';
import type { SequenceJobData } from '../../modules/email-sequences/email-sequences.service';

@Processor(QUEUE_NAMES.ONBOARDING_DRIP)
export class OnboardingDripProcessor extends WorkerHost {
  private readonly logger = new Logger(OnboardingDripProcessor.name);

  async process(job: Job<DripJobData | SequenceJobData>): Promise<void> {
    this.logger.log(
      `Processing ${job.name} for ${job.data.email} (business ${job.data.businessId})`,
    );

    try {
      if (job.name.startsWith('seq-step-')) {
        // Email sequence step
        const { EmailSequenceService } =
          await import('../../modules/email-sequences/email-sequences.service');
        const seqService = (this as any).moduleRef?.get(EmailSequenceService);

        if (!seqService) {
          throw new Error('EmailSequenceService not available — cannot process job');
        }

        const data = job.data as SequenceJobData;
        await seqService.processStep(data.enrollmentId, data.step);
      } else {
        // Legacy onboarding drip step
        const { OnboardingDripService } =
          await import('../../modules/onboarding-drip/onboarding-drip.service');
        const dripService = (this as any).moduleRef?.get(OnboardingDripService);

        if (!dripService) {
          throw new Error('OnboardingDripService not available — cannot process job');
        }

        await dripService.sendDripEmail(job.data as DripJobData);
      }
    } catch (err) {
      this.logger.error(`Job ${job.id} failed: ${(err as Error).message}`, (err as Error).stack);
      throw err;
    }
  }
}
