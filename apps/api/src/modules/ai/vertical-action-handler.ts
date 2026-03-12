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

  constructor(
    private actionCardService: ActionCardService,
    private prisma: PrismaService,
  ) {}

  async handleVerticalAction(ctx: VerticalActionContext) {
    // Special handling for dealership sales inquiries
    if (ctx.verticalPack === 'dealership' && ctx.intent === 'SALES_INQUIRY') {
      try {
        return await this.handleDealershipSalesInquiry(ctx);
      } catch (err: any) {
        this.logger.error(`Failed to handle dealership sales inquiry: ${err.message}`);
        return null;
      }
    }

    // Standard handling for all other vertical actions
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

  private async handleDealershipSalesInquiry(ctx: VerticalActionContext) {
    if (!ctx.customerId) {
      // No customer context — fall back to standard SALES_LEAD
      return this.createStandardAction(ctx, VERTICAL_ACTIONS.dealership.SALES_INQUIRY);
    }

    // Check for existing open deals
    const openDeal = await this.prisma.deal.findFirst({
      where: {
        customerId: ctx.customerId,
        businessId: ctx.businessId,
        stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
      },
      include: { vehicle: { select: { year: true, make: true, model: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    if (openDeal) {
      const vehicleLabel = openDeal.vehicle
        ? `${openDeal.vehicle.year} ${openDeal.vehicle.make} ${openDeal.vehicle.model}`
        : 'vehicle';
      return this.actionCardService.create({
        businessId: ctx.businessId,
        type: 'DEAL_UPDATE',
        category: 'OPPORTUNITY',
        priority: 85,
        title: `Update deal for ${ctx.customerName || 'customer'}`,
        description: `${ctx.customerName || 'Customer'} has an open deal (${openDeal.stage}) for ${vehicleLabel}. Review and update the deal stage.`,
        suggestedAction: 'Open deal in pipeline and advance to next stage',
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        metadata: { ...this.baseMetadata(ctx), dealId: openDeal.id },
      });
    }

    // Check for test drives without follow-up
    const recentTestDrives = await this.prisma.testDrive.findMany({
      where: {
        customer: { id: ctx.customerId },
        vehicle: { businessId: ctx.businessId },
        status: 'COMPLETED',
      },
      include: { vehicle: { select: { year: true, make: true, model: true } } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // Check if there are test drives but no deal for those vehicles
    if (recentTestDrives.length > 0) {
      const testDriveVehicleIds = recentTestDrives.map((td) => td.vehicleId);
      const existingDeals = await this.prisma.deal.count({
        where: {
          customerId: ctx.customerId,
          businessId: ctx.businessId,
          vehicleId: { in: testDriveVehicleIds },
        },
      });
      if (existingDeals === 0) {
        const v = recentTestDrives[0].vehicle;
        const vehicleLabel = v ? `${v.year} ${v.make} ${v.model}` : 'a vehicle';
        return this.actionCardService.create({
          businessId: ctx.businessId,
          type: 'TEST_DRIVE_FOLLOWUP',
          category: 'OPPORTUNITY',
          priority: 82,
          title: `Follow up on test drive for ${ctx.customerName || 'customer'}`,
          description: `${ctx.customerName || 'Customer'} completed a test drive of ${vehicleLabel} but has no open deal. Create a deal to track the opportunity.`,
          suggestedAction: 'Create a new deal and assign to a salesperson',
          conversationId: ctx.conversationId,
          customerId: ctx.customerId,
          metadata: { ...this.baseMetadata(ctx), testDriveId: recentTestDrives[0].id },
        });
      }
    }

    // No existing deal or test drives — create standard SALES_LEAD
    return this.createStandardAction(ctx, VERTICAL_ACTIONS.dealership.SALES_INQUIRY);
  }

  async checkStalledDeals(businessId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const stalledDeals = await this.prisma.deal.findMany({
      where: {
        businessId,
        stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
        updatedAt: { lt: sevenDaysAgo },
      },
      include: {
        customer: { select: { id: true, name: true } },
        vehicle: { select: { year: true, make: true, model: true } },
        assignedTo: { select: { name: true } },
      },
    });

    const cards = [];
    for (const deal of stalledDeals) {
      const vehicleLabel = deal.vehicle
        ? `${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model}`
        : '';
      const daysStalled = Math.floor(
        (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      try {
        const card = await this.actionCardService.create({
          businessId,
          type: 'DEAL_STALLED',
          category: 'NEEDS_APPROVAL',
          priority: 75,
          title: `Stalled deal: ${deal.customer.name}`,
          description: `Deal for ${vehicleLabel} has been at ${deal.stage} stage for ${daysStalled} days. ${deal.assignedTo ? `Assigned to ${deal.assignedTo.name}.` : 'Unassigned.'} Review and take action.`,
          suggestedAction: 'Contact customer or update deal stage',
          customerId: deal.customer.id,
          metadata: {
            dealId: deal.id,
            stage: deal.stage,
            daysStalled,
            source: 'deal-stalled-detection',
          },
        });
        cards.push(card);
      } catch (err: any) {
        this.logger.warn(`Failed to create stalled deal card for deal ${deal.id}: ${err.message}`);
      }
    }
    return cards;
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
