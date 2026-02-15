import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';

export interface AiProcessingJobData {
  businessId: string;
  conversationId: string;
  messageId: string;
  messageBody: string;
}

@Processor(QUEUE_NAMES.AI_PROCESSING)
export class AiProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessingProcessor.name);

  async process(job: Job<AiProcessingJobData>): Promise<void> {
    const { businessId, conversationId, messageId, messageBody } = job.data;
    this.logger.log(`Processing AI job ${job.id} for conversation ${conversationId}`);

    // Dynamically import to avoid circular dependency
    const { AiService } = await import('../../modules/ai/ai.service');
    const aiService = (this as any).moduleRef?.get(AiService);

    if (!aiService) {
      this.logger.warn('AiService not available — skipping job');
      return;
    }

    await aiService.processInboundMessage(
      businessId,
      conversationId,
      messageId,
      messageBody,
    );
  }
}
