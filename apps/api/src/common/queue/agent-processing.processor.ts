import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';

export interface AgentProcessingJobData {
  businessId: string;
  agentType: string;
  triggeredManually?: boolean;
}

@Processor(QUEUE_NAMES.AGENT_PROCESSING)
export class AgentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentProcessingProcessor.name);

  async process(job: Job<AgentProcessingJobData>): Promise<void> {
    const { businessId, agentType, triggeredManually } = job.data;
    this.logger.log(
      `Processing agent job ${job.id}: ${agentType} for business ${businessId}${triggeredManually ? ' (manual trigger)' : ''}`,
    );

    const { AgentFrameworkService } = await import(
      '../../modules/agent/agent-framework.service'
    );
    const agentFrameworkService = (this as any).moduleRef?.get(AgentFrameworkService);

    if (!agentFrameworkService) {
      throw new Error('AgentFrameworkService not available — cannot process job');
    }

    try {
      const result = await agentFrameworkService.triggerAgent(businessId, agentType);
      this.logger.log(
        `Agent ${agentType} completed for business ${businessId}: ${result.cardsCreated ?? 0} cards created`,
      );
    } catch (err) {
      this.logger.error(
        `Agent processing failed for job ${job.id}, agent ${agentType}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AgentProcessingJobData>, error: Error) {
    this.logger.warn(
      `Agent processing job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts || 1}): ${error.message}`,
    );
  }
}
