import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';
import { InboxGateway } from '../inbox.gateway';

export interface AiProcessingJobData {
  businessId: string;
  conversationId: string;
  messageId: string;
  messageBody: string;
  channel?: string;
  customerName?: string;
  customerId?: string;
}

@Processor(QUEUE_NAMES.AI_PROCESSING)
export class AiProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessingProcessor.name);

  async process(job: Job<AiProcessingJobData>): Promise<void> {
    const { businessId, conversationId, messageId, messageBody } = job.data;
    this.logger.log(
      `Processing AI job ${job.id} for conversation ${conversationId} (attempt ${job.attemptsMade + 1}/${job.opts?.attempts || 1})`,
    );

    // Emit "AI is processing" event
    const inboxGateway = this.getService('InboxGateway');
    if (inboxGateway) {
      inboxGateway.emitToBusinessRoom(businessId, 'ai:processing', {
        conversationId,
        messageId,
      });
    }

    // Dynamically import to avoid circular dependency
    const { AiService } = await import('../../modules/ai/ai.service');
    const aiService = (this as any).moduleRef?.get(AiService);

    if (!aiService) {
      throw new Error('AiService not available — cannot process job');
    }

    try {
      await aiService.processInboundMessage(businessId, conversationId, messageId, messageBody);

      // Emit success event
      if (inboxGateway) {
        inboxGateway.emitToBusinessRoom(businessId, 'ai:draft-ready', {
          conversationId,
          messageId,
        });
      }
    } catch (err) {
      this.logger.error(
        `AI processing failed for job ${job.id}, conversation ${conversationId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err; // BullMQ will retry based on job options
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AiProcessingJobData>, error: Error) {
    const { businessId, conversationId, messageId, customerName, customerId } = job.data;
    const isFinalAttempt = job.attemptsMade >= (job.opts?.attempts || 1);

    this.logger.warn(
      `AI job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts || 1}): ${error.message}`,
    );

    if (isFinalAttempt) {
      this.logger.error(
        `AI job ${job.id} exhausted all retries for conversation ${conversationId}`,
      );

      // Emit failure event
      const inboxGateway = this.getService('InboxGateway');
      if (inboxGateway) {
        inboxGateway.emitToBusinessRoom(businessId, 'ai:processing-failed', {
          conversationId,
          messageId,
          error: error.message,
        });
      }

      // Create ActionCard for failed processing
      await this.createFailureActionCard(job.data, error);
    }
  }

  private async createFailureActionCard(data: AiProcessingJobData, error: Error): Promise<void> {
    try {
      const { ActionCardService } = await import('../../modules/action-card/action-card.service');
      const actionCardService = (this as any).moduleRef?.get(ActionCardService);

      if (!actionCardService) {
        this.logger.warn('ActionCardService not available — skipping failure card');
        return;
      }

      await actionCardService.create({
        businessId: data.businessId,
        type: 'AI_PROCESSING_FAILED',
        category: 'URGENT_TODAY',
        priority: 80,
        title: `AI failed to process message${data.customerName ? ` from ${data.customerName}` : ''}`,
        description: `The AI could not generate a response after 3 attempts. Error: ${error.message}`,
        suggestedAction: 'Review the conversation and reply manually, or retry AI processing.',
        ctaConfig: [
          { action: 'retry_ai', label: 'Retry AI' },
          { action: 'reply_manually', label: 'Reply Manually' },
          { action: 'dismiss', label: 'Dismiss' },
        ],
        conversationId: data.conversationId,
        customerId: data.customerId,
        metadata: {
          messageId: data.messageId,
          error: error.message,
          channel: data.channel,
          source: 'ai-processing-queue',
        },
      });

      this.logger.log(
        `Created AI_PROCESSING_FAILED action card for conversation ${data.conversationId}`,
      );
    } catch (cardErr) {
      this.logger.error(`Failed to create AI failure action card: ${(cardErr as Error).message}`);
    }
  }

  private getService(serviceName: string): any {
    try {
      const moduleRef = (this as any).moduleRef;
      if (!moduleRef) return null;

      if (serviceName === 'InboxGateway') {
        return moduleRef.get(InboxGateway, { strict: false }) ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }
}
