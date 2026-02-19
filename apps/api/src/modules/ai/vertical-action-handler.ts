import { Injectable, Logger } from '@nestjs/common';
import { ActionCardService } from '../action-card/action-card.service';

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
  dealership: {
    BOOK_APPOINTMENT: {
      cardType: 'SERVICE_APPOINTMENT',
      category: 'NEEDS_APPROVAL',
      priority: 70,
      titleTemplate: (ctx) => `Service appointment for ${ctx.customerName || 'customer'}`,
      descriptionTemplate: (ctx) =>
        `Because ${ctx.customerName || 'a customer'} wants to schedule a service appointment. Review vehicle history and create a quote.`,
      suggestedAction: 'Create quote and update kanban status',
    },
    SALES_INQUIRY: {
      cardType: 'SALES_LEAD',
      category: 'OPPORTUNITY',
      priority: 80,
      titleTemplate: (ctx) => `Sales lead: ${ctx.customerName || 'customer'}`,
      descriptionTemplate: (ctx) =>
        `Because ${ctx.customerName || 'a customer'} is interested in purchasing. Transfer to sales team for follow-up.`,
      suggestedAction: 'Assign to sales rep and update CRM',
    },
    TRADE_IN_INQUIRY: {
      cardType: 'TRADE_IN_LEAD',
      category: 'OPPORTUNITY',
      priority: 75,
      titleTemplate: (ctx) => `Trade-in inquiry: ${ctx.customerName || 'customer'}`,
      descriptionTemplate: (ctx) =>
        `Because ${ctx.customerName || 'a customer'} is interested in trading in their vehicle. Collect vehicle details for appraisal.`,
      suggestedAction: 'Request vehicle photos and schedule appraisal',
    },
  },
};

@Injectable()
export class VerticalActionHandler {
  private readonly logger = new Logger(VerticalActionHandler.name);

  constructor(private actionCardService: ActionCardService) {}

  async handleVerticalAction(ctx: VerticalActionContext) {
    const packActions = VERTICAL_ACTIONS[ctx.verticalPack];
    if (!packActions) return null;

    const actionConfig = packActions[ctx.intent];
    if (!actionConfig) return null;

    try {
      return await this.actionCardService.create({
        businessId: ctx.businessId,
        type: actionConfig.cardType,
        category: actionConfig.category,
        priority: actionConfig.priority,
        title: actionConfig.titleTemplate(ctx),
        description: actionConfig.descriptionTemplate(ctx),
        suggestedAction: actionConfig.suggestedAction,
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        metadata: {
          verticalPack: ctx.verticalPack,
          intent: ctx.intent,
          confidence: ctx.confidence,
          source: 'vertical-action-handler',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create vertical action card for ${ctx.verticalPack}/${ctx.intent}: ${err.message}`,
      );
      return null;
    }
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
