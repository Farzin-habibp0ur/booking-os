import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';

interface RetentionAgentConfig {
  maxCardsPerRun?: number;
  overdueThresholdMultiplier?: number;
  minBookings?: number;
  lookBackDays?: number;
}

interface CustomerCadence {
  customerId: string;
  customerName: string;
  avgDaysBetween: number;
  daysSinceLastBooking: number;
  totalBookings: number;
  lastBookingDate: Date;
  lastServiceName: string;
}

@Injectable()
export class RetentionAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'RETENTION';
  private readonly logger = new Logger(RetentionAgentService.name);

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
    if (config.overdueThresholdMultiplier !== undefined) {
      if (typeof config.overdueThresholdMultiplier !== 'number' || config.overdueThresholdMultiplier < 1) return false;
    }
    if (config.minBookings !== undefined) {
      if (typeof config.minBookings !== 'number' || config.minBookings < 2) return false;
    }
    if (config.lookBackDays !== undefined) {
      if (typeof config.lookBackDays !== 'number' || config.lookBackDays < 30) return false;
    }
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    const agentConfig: RetentionAgentConfig = config || {};
    const maxCards = agentConfig.maxCardsPerRun || 10;
    const thresholdMultiplier = agentConfig.overdueThresholdMultiplier || 1.5;
    const minBookings = agentConfig.minBookings || 2;
    const lookBackDays = agentConfig.lookBackDays || 180;

    const overdueCustomers = await this.findOverdueCustomers(
      businessId,
      thresholdMultiplier,
      minBookings,
      lookBackDays,
    );

    if (overdueCustomers.length === 0) {
      this.logger.log(`No overdue customers found for business ${businessId}`);
      return { cardsCreated: 0 };
    }

    let cardsCreated = 0;

    for (const customer of overdueCustomers) {
      if (cardsCreated >= maxCards) break;

      try {
        // Dedup: skip if there's already a pending RETENTION_DUE card for this customer
        const existingCard = await this.prisma.actionCard.findFirst({
          where: {
            businessId,
            type: 'RETENTION_DUE',
            status: 'PENDING',
            customerId: customer.customerId,
          },
        });

        if (existingCard) continue;

        const overdueDays = Math.round(customer.daysSinceLastBooking - customer.avgDaysBetween);

        await this.actionCardService.create({
          businessId,
          type: 'RETENTION_DUE',
          category: 'OPPORTUNITY',
          priority: this.calculatePriority(customer),
          title: `${customer.customerName} may be overdue`,
          description: `Because ${customer.customerName} typically books every ${Math.round(customer.avgDaysBetween)} days, but it's been ${customer.daysSinceLastBooking} days since their last visit. Their last service was ${customer.lastServiceName}.`,
          suggestedAction: `Send a personalized follow-up about ${customer.lastServiceName} and offer to book their next appointment`,
          customerId: customer.customerId,
          preview: {
            avgDaysBetween: Math.round(customer.avgDaysBetween),
            daysSinceLastBooking: customer.daysSinceLastBooking,
            overdueDays,
            totalBookings: customer.totalBookings,
            lastServiceName: customer.lastServiceName,
            lastBookingDate: customer.lastBookingDate.toISOString(),
          },
          ctaConfig: [
            { label: 'Send Follow-up', action: 'send_followup', variant: 'primary' },
            { label: 'Snooze', action: 'snooze', variant: 'secondary' },
            { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
          ],
          metadata: {
            overdueDays,
            avgCadence: Math.round(customer.avgDaysBetween),
            source: 'retention-agent',
          },
        });

        cardsCreated++;
      } catch (err: any) {
        this.logger.warn(
          `Failed to create retention card for customer ${customer.customerId}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Retention agent created ${cardsCreated} cards for business ${businessId} (${overdueCustomers.length} overdue customers found)`,
    );

    return { cardsCreated };
  }

  async findOverdueCustomers(
    businessId: string,
    thresholdMultiplier: number,
    minBookings: number,
    lookBackDays: number,
  ): Promise<CustomerCadence[]> {
    const since = new Date();
    since.setDate(since.getDate() - lookBackDays);
    const now = new Date();

    // Get customers with completed bookings in the look-back window
    const customers = await this.prisma.customer.findMany({
      where: {
        businessId,
        bookings: {
          some: {
            status: { in: ['COMPLETED', 'CONFIRMED'] },
            startTime: { gte: since },
          },
        },
      },
      select: {
        id: true,
        name: true,
        bookings: {
          where: {
            status: { in: ['COMPLETED', 'CONFIRMED'] },
            startTime: { gte: since },
          },
          select: {
            startTime: true,
            service: { select: { name: true } },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    const overdueCustomers: CustomerCadence[] = [];

    for (const customer of customers) {
      const bookings = customer.bookings;
      if (bookings.length < minBookings) continue;

      // Calculate average days between bookings
      const intervals: number[] = [];
      for (let i = 1; i < bookings.length; i++) {
        const prev = new Date(bookings[i - 1].startTime).getTime();
        const curr = new Date(bookings[i].startTime).getTime();
        intervals.push((curr - prev) / (1000 * 60 * 60 * 24));
      }

      const avgDaysBetween = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
      const lastBooking = bookings[bookings.length - 1];
      const daysSinceLastBooking = Math.round(
        (now.getTime() - new Date(lastBooking.startTime).getTime()) / (1000 * 60 * 60 * 24),
      );

      // Check if they're overdue (exceeded their typical cadence by the threshold)
      if (daysSinceLastBooking > avgDaysBetween * thresholdMultiplier) {
        overdueCustomers.push({
          customerId: customer.id,
          customerName: customer.name,
          avgDaysBetween,
          daysSinceLastBooking,
          totalBookings: bookings.length,
          lastBookingDate: new Date(lastBooking.startTime),
          lastServiceName: lastBooking.service.name,
        });
      }
    }

    // Sort by how overdue they are (most overdue first)
    overdueCustomers.sort(
      (a, b) =>
        (b.daysSinceLastBooking / b.avgDaysBetween) -
        (a.daysSinceLastBooking / a.avgDaysBetween),
    );

    return overdueCustomers;
  }

  private calculatePriority(customer: CustomerCadence): number {
    // More overdue = higher priority (60-90 range)
    const overdueRatio = customer.daysSinceLastBooking / customer.avgDaysBetween;
    const basePriority = 60;
    const bonus = Math.min(30, Math.round((overdueRatio - 1) * 15));
    return basePriority + bonus;
  }
}
