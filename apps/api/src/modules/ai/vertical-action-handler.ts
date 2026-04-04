import { Injectable, Logger } from '@nestjs/common';
import { ActionCardService } from '../action-card/action-card.service';
import { PrismaService } from '../../common/prisma.service';

export interface VerticalActionContext {
  businessId: string;
  conversationId: string;
  customerId?: string;
  customerName?: string;
  verticalPack: string;
  intent: string;
  confidence: number;
}

interface VerticalActionConfig {
  cardType: string;
  category: string;
  priority: number;
  titleTemplate: (ctx: VerticalActionContext) => string;
  descriptionTemplate: (ctx: VerticalActionContext) => string;
  suggestedAction: string;
}

const VERTICAL_ACTIONS: Record<string, Record<string, VerticalActionConfig>> = {
  aesthetics: {
    BOOK_APPOINTMENT: {
      cardType: 'CONSULT_TO_TREATMENT',
      category: 'OPPORTUNITY',
      priority: 65,
      titleTemplate: (ctx) => `Treatment opportunity for ${ctx.customerName || 'customer'}`,
      descriptionTemplate: (ctx) =>
        `Because ${ctx.customerName || 'a customer'} is booking a consultation. Review their profile for upsell potential and prepare a treatment plan.`,
      suggestedAction: 'Review treatment playbook and prepare recommendations',
    },
    INQUIRY: {
      cardType: 'TREATMENT_INQUIRY',
      category: 'OPPORTUNITY',
      priority: 55,
      titleTemplate: (ctx) => `Treatment inquiry from ${ctx.customerName || 'customer'}`,
      descriptionTemplate: (ctx) =>
        `Because ${ctx.customerName || 'a customer'} is inquiring about treatments. This is a potential booking opportunity.`,
      suggestedAction: 'Send treatment menu and booking link',
    },
  },
};

@Injectable()
export class VerticalActionHandler {
  private readonly logger = new Logger(VerticalActionHandler.name);

  constructor(
    private actionCardService: ActionCardService,
    private prisma: PrismaService,
  ) {}

  async handleVerticalAction(ctx: VerticalActionContext) {
    // Standard handling for all vertical actions
    const packActions = VERTICAL_ACTIONS[ctx.verticalPack];
    if (!packActions) return null;
    const actionConfig = packActions[ctx.intent];
    if (!actionConfig) return null;

    try {
      return await this.createStandardAction(ctx, actionConfig);
    } catch (err: any) {
      this.logger.error(`Failed to create vertical action card: ${err.message}`);
      return null;
    }
  }

  private baseMetadata(ctx: VerticalActionContext) {
    return {
      verticalPack: ctx.verticalPack,
      intent: ctx.intent,
      confidence: ctx.confidence,
      source: 'vertical-action-handler',
    };
  }

  private async createStandardAction(ctx: VerticalActionContext, config: VerticalActionConfig) {
    return this.actionCardService.create({
      businessId: ctx.businessId,
      type: config.cardType,
      category: config.category,
      priority: config.priority,
      title: config.titleTemplate(ctx),
      description: config.descriptionTemplate(ctx),
      suggestedAction: config.suggestedAction,
      conversationId: ctx.conversationId,
      customerId: ctx.customerId,
      metadata: this.baseMetadata(ctx),
    });
  }

  getAvailableActions(verticalPack: string): string[] {
    const packActions = VERTICAL_ACTIONS[verticalPack];
    if (!packActions) return [];
    return Object.keys(packActions);
  }

  hasVerticalAction(verticalPack: string, intent: string): boolean {
    return !!VERTICAL_ACTIONS[verticalPack]?.[intent];
  }
}
