import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';
import { AvailabilityService, TimeSlot } from '../../availability/availability.service';

interface WaitlistAgentConfig {
  maxCardsPerRun?: number;
  lookAheadDays?: number;
  topSlots?: number;
}

interface SlotMatch {
  entry: {
    id: string;
    customerId: string;
    serviceId: string;
    staffId: string | null;
    customer: { id: string; name: string };
    service: { id: string; name: string; durationMins: number };
    staff: { id: string; name: string } | null;
    timeWindowStart: string | null;
    timeWindowEnd: string | null;
    dateFrom: Date | null;
    dateTo: Date | null;
  };
  slots: TimeSlot[];
}

@Injectable()
export class WaitlistAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'WAITLIST';
  private readonly logger = new Logger(WaitlistAgentService.name);

  constructor(
    private prisma: PrismaService,
    private agentFramework: AgentFrameworkService,
    private actionCardService: ActionCardService,
    private availabilityService: AvailabilityService,
  ) {}

  onModuleInit() {
    this.agentFramework.registerAgent(this);
  }

  validateConfig(config: any): boolean {
    if (!config) return true;
    if (config.maxCardsPerRun !== undefined) {
      if (typeof config.maxCardsPerRun !== 'number' || config.maxCardsPerRun < 1) return false;
    }
    if (config.lookAheadDays !== undefined) {
      if (typeof config.lookAheadDays !== 'number' || config.lookAheadDays < 1) return false;
    }
    if (config.topSlots !== undefined) {
      if (typeof config.topSlots !== 'number' || config.topSlots < 1) return false;
    }
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    const agentConfig: WaitlistAgentConfig = config || {};
    const maxCards = agentConfig.maxCardsPerRun || 10;
    const lookAheadDays = agentConfig.lookAheadDays || 7;
    const topSlots = agentConfig.topSlots || 3;

    // Find ACTIVE waitlist entries
    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
      },
      include: {
        customer: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMins: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    if (entries.length === 0) {
      this.logger.log(`No active waitlist entries for business ${businessId}`);
      return { cardsCreated: 0 };
    }

    let cardsCreated = 0;

    for (const entry of entries) {
      if (cardsCreated >= maxCards) break;

      try {
        // Check if there's already a pending WAITLIST_MATCH card for this entry
        const existingCard = await this.prisma.actionCard.findFirst({
          where: {
            businessId,
            type: 'WAITLIST_MATCH',
            status: 'PENDING',
            customerId: entry.customerId,
            metadata: {
              path: ['waitlistEntryId'],
              equals: entry.id,
            },
          },
        });

        if (existingCard) continue;

        // Find available slots across the look-ahead window
        const matchedSlots = await this.findMatchingSlots(
          businessId,
          entry as any,
          lookAheadDays,
          topSlots,
        );

        if (matchedSlots.length === 0) continue;

        // Create action card with top matches
        await this.actionCardService.create({
          businessId,
          type: 'WAITLIST_MATCH',
          category: 'OPPORTUNITY',
          priority: 70,
          title: `Waitlist match for ${entry.customer.name}`,
          description: `Because ${entry.customer.name} is waiting for ${entry.service.name}. ${matchedSlots.length} available slot${matchedSlots.length > 1 ? 's' : ''} found in the next ${lookAheadDays} days.`,
          suggestedAction: 'Offer the best matching slot to the customer',
          customerId: entry.customerId,
          preview: {
            waitlistEntryId: entry.id,
            serviceName: entry.service.name,
            preferredStaff: entry.staff?.name || null,
            slots: matchedSlots.map((s) => ({
              time: s.time,
              display: s.display,
              staffName: s.staffName,
              staffId: s.staffId,
            })),
          },
          ctaConfig: [
            { label: 'Offer Slot', action: 'offer_slot', variant: 'primary' },
            { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
          ],
          metadata: {
            waitlistEntryId: entry.id,
            serviceId: entry.serviceId,
            slotsFound: matchedSlots.length,
            source: 'waitlist-agent',
          },
        });

        cardsCreated++;
      } catch (err: any) {
        this.logger.warn(
          `Failed to process waitlist entry ${entry.id}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Waitlist agent created ${cardsCreated} cards for business ${businessId} (${entries.length} entries scanned)`,
    );

    return { cardsCreated };
  }

  async findMatchingSlots(
    businessId: string,
    entry: SlotMatch['entry'],
    lookAheadDays: number,
    topSlots: number,
  ): Promise<TimeSlot[]> {
    const today = new Date();
    const matchedSlots: TimeSlot[] = [];

    for (let dayOffset = 0; dayOffset < lookAheadDays; dayOffset++) {
      if (matchedSlots.length >= topSlots) break;

      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      const dateStr = checkDate.toISOString().split('T')[0];

      // Check date range preferences
      if (entry.dateFrom && checkDate < entry.dateFrom) continue;
      if (entry.dateTo && checkDate > entry.dateTo) continue;

      try {
        const slots = await this.availabilityService.getAvailableSlots(
          businessId,
          dateStr,
          entry.serviceId,
          entry.staffId || undefined,
        );

        // Filter to available slots only
        const available = slots.filter((s) => s.available);

        // Filter by time window preference
        const filtered = this.filterByTimeWindow(
          available,
          entry.timeWindowStart,
          entry.timeWindowEnd,
        );

        for (const slot of filtered) {
          if (matchedSlots.length >= topSlots) break;
          matchedSlots.push(slot);
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to get slots for date ${dateStr}: ${err.message}`,
        );
      }
    }

    return matchedSlots;
  }

  private filterByTimeWindow(
    slots: TimeSlot[],
    windowStart: string | null,
    windowEnd: string | null,
  ): TimeSlot[] {
    if (!windowStart && !windowEnd) return slots;

    return slots.filter((slot) => {
      const slotTime = slot.display; // "HH:mm" format
      if (windowStart && slotTime < windowStart) return false;
      if (windowEnd && slotTime > windowEnd) return false;
      return true;
    });
  }
}
