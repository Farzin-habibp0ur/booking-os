import { Injectable, Logger } from '@nestjs/common';
import { ActionCardService } from '../action-card/action-card.service';

export interface ClarificationContext {
  businessId: string;
  conversationId: string;
  customerId?: string;
  customerName?: string;
  messageContent: string;
  intent: string;
  confidence: number;
}

@Injectable()
export class ClarificationHandler {
  private readonly logger = new Logger(ClarificationHandler.name);

  private static readonly LOW_CONFIDENCE_THRESHOLD = 0.4;
  private static readonly MEDIUM_CONFIDENCE_THRESHOLD = 0.6;

  constructor(private actionCardService: ActionCardService) {}

  async handleAmbiguousIntent(ctx: ClarificationContext) {
    if (ctx.confidence >= ClarificationHandler.MEDIUM_CONFIDENCE_THRESHOLD) {
      return null;
    }

    try {
      const isVeryLow = ctx.confidence < ClarificationHandler.LOW_CONFIDENCE_THRESHOLD;
      const priority = isVeryLow ? 85 : 65;
      const category = isVeryLow ? 'URGENT_TODAY' : 'NEEDS_APPROVAL';

      return await this.actionCardService.create({
        businessId: ctx.businessId,
        type: 'CLARIFICATION_NEEDED',
        category,
        priority,
        title: `Clarify intent for ${ctx.customerName || 'customer'}`,
        description: `Because the AI detected "${ctx.intent}" with only ${Math.round(ctx.confidence * 100)}% confidence. The message may need human interpretation.`,
        suggestedAction: isVeryLow
          ? 'Take over the conversation and respond manually'
          : 'Review the AI suggestion and edit before sending',
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        metadata: {
          intent: ctx.intent,
          confidence: ctx.confidence,
          messagePreview: ctx.messageContent.slice(0, 200),
          confidenceLevel: isVeryLow ? 'very_low' : 'low',
          source: 'clarification-handler',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create clarification card for conversation ${ctx.conversationId}: ${err.message}`,
      );
      return null;
    }
  }

  async handleConflictingIntents(
    ctx: ClarificationContext,
    detectedIntents: Array<{ intent: string; confidence: number }>,
  ) {
    if (detectedIntents.length < 2) return null;

    try {
      const intentList = detectedIntents
        .map((i) => `${i.intent} (${Math.round(i.confidence * 100)}%)`)
        .join(', ');

      return await this.actionCardService.create({
        businessId: ctx.businessId,
        type: 'CLARIFICATION_NEEDED',
        category: 'NEEDS_APPROVAL',
        priority: 70,
        title: `Multiple intents detected for ${ctx.customerName || 'customer'}`,
        description: `Because the AI detected multiple possible intents: ${intentList}. Human judgment needed to determine the correct course of action.`,
        suggestedAction: 'Review the conversation and select the appropriate response',
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        metadata: {
          detectedIntents,
          messagePreview: ctx.messageContent.slice(0, 200),
          source: 'clarification-handler',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create conflicting-intent card for conversation ${ctx.conversationId}: ${err.message}`,
      );
      return null;
    }
  }

  shouldRequestClarification(confidence: number): boolean {
    return confidence < ClarificationHandler.MEDIUM_CONFIDENCE_THRESHOLD;
  }
}
