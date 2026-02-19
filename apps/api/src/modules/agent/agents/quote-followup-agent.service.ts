import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';

interface QuoteFollowupConfig {
  maxCardsPerRun?: number;
  staleDays?: number;
  minQuoteAmount?: number;
}

interface StalledQuote {
  id: string;
  bookingId: string;
  description: string;
  totalAmount: number;
  daysSinceCreated: number;
  customerName: string;
  customerId: string;
  serviceName: string;
}

@Injectable()
export class QuoteFollowupAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'QUOTE_FOLLOWUP';
  private readonly logger = new Logger(QuoteFollowupAgentService.name);

  constructor(
    private prisma: PrismaService,
    private agentFramework: AgentFrameworkService,
    private actionCardService: ActionCardService,
  ) {}

  onModuleInit() {
    this.agentFramework.registerAgent(this);
  }

  validateConfig(config: any): boolean {
    if (!config) return true;
    if (config.maxCardsPerRun !== undefined) {
      if (typeof config.maxCardsPerRun !== 'number' || config.maxCardsPerRun < 1) return false;
    }
    if (config.staleDays !== undefined) {
      if (typeof config.staleDays !== 'number' || config.staleDays < 1) return false;
    }
    if (config.minQuoteAmount !== undefined) {
      if (typeof config.minQuoteAmount !== 'number' || config.minQuoteAmount < 0) return false;
    }
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    const agentConfig: QuoteFollowupConfig = config || {};
    const maxCards = agentConfig.maxCardsPerRun || 10;
    const staleDays = agentConfig.staleDays || 3;
    const minQuoteAmount = agentConfig.minQuoteAmount || 0;

    const stalledQuotes = await this.findStalledQuotes(businessId, staleDays, minQuoteAmount);

    if (stalledQuotes.length === 0) {
      this.logger.log(`No stalled quotes found for business ${businessId}`);
      return { cardsCreated: 0 };
    }

    let cardsCreated = 0;

    for (const quote of stalledQuotes) {
      if (cardsCreated >= maxCards) break;

      try {
        // Dedup: check for existing pending card for this quote
        const existingCard = await this.prisma.actionCard.findFirst({
          where: {
            businessId,
            type: 'STALLED_QUOTE',
            status: 'PENDING',
            metadata: {
              path: ['quoteId'],
              equals: quote.id,
            },
          },
        });

        if (existingCard) continue;

        await this.actionCardService.create({
          businessId,
          type: 'STALLED_QUOTE',
          category: 'OPPORTUNITY',
          priority: this.calculatePriority(quote.totalAmount, quote.daysSinceCreated),
          title: `Quote pending: ${quote.customerName}`,
          description: `Because ${quote.customerName}'s quote for ${quote.serviceName} ($${quote.totalAmount.toFixed(2)}) has been pending for ${quote.daysSinceCreated} days. Follow up to convert.`,
          suggestedAction: `Send a follow-up message about their ${quote.serviceName} quote`,
          customerId: quote.customerId,
          bookingId: quote.bookingId,
          preview: {
            quoteId: quote.id,
            totalAmount: quote.totalAmount,
            description: quote.description,
            daysSinceCreated: quote.daysSinceCreated,
            serviceName: quote.serviceName,
          },
          ctaConfig: [
            { label: 'Send Follow-up', action: 'send_followup', variant: 'primary' },
            { label: 'Snooze', action: 'snooze', variant: 'secondary' },
            { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
          ],
          metadata: {
            quoteId: quote.id,
            totalAmount: quote.totalAmount,
            daysSinceCreated: quote.daysSinceCreated,
            source: 'quote-followup-agent',
          },
        });

        cardsCreated++;
      } catch (err: any) {
        this.logger.warn(`Failed to create follow-up card for quote ${quote.id}: ${err.message}`);
      }
    }

    this.logger.log(
      `Quote follow-up agent created ${cardsCreated} cards for business ${businessId} (${stalledQuotes.length} stalled quotes found)`,
    );

    return { cardsCreated };
  }

  async findStalledQuotes(
    businessId: string,
    staleDays: number,
    minQuoteAmount: number,
  ): Promise<StalledQuote[]> {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleDays);

    const quotes = await this.prisma.quote.findMany({
      where: {
        businessId,
        status: 'PENDING',
        createdAt: { lte: staleDate },
        totalAmount: { gte: minQuoteAmount },
      },
      include: {
        booking: {
          include: {
            customer: { select: { id: true, name: true } },
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { totalAmount: 'desc' },
      take: 50,
    });

    const now = Date.now();

    return quotes.map((q) => ({
      id: q.id,
      bookingId: q.bookingId,
      description: q.description,
      totalAmount: q.totalAmount,
      daysSinceCreated: Math.round((now - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      customerName: q.booking.customer.name,
      customerId: q.booking.customer.id,
      serviceName: q.booking.service.name,
    }));
  }

  private calculatePriority(totalAmount: number, daysSinceCreated: number): number {
    // Higher amount + longer stale = higher priority (55-85 range)
    const basePriority = 55;
    const amountBonus = Math.min(15, Math.round(totalAmount / 100));
    const staleBonus = Math.min(15, daysSinceCreated * 2);
    return basePriority + amountBonus + staleBonus;
  }
}
