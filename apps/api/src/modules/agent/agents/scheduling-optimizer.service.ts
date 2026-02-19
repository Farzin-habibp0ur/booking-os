import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';

interface SchedulingOptimizerConfig {
  maxCardsPerRun?: number;
  lookAheadDays?: number;
  gapThresholdMins?: number;
  minGapCount?: number;
}

interface ScheduleGap {
  date: string;
  staffId: string;
  staffName: string;
  gapStart: string; // "HH:mm"
  gapEnd: string;
  durationMins: number;
}

interface DaySchedule {
  date: string;
  staffId: string;
  staffName: string;
  workStart: number; // minutes from midnight
  workEnd: number;
  bookings: { startMins: number; endMins: number }[];
}

@Injectable()
export class SchedulingOptimizerService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'SCHEDULING_OPTIMIZER';
  private readonly logger = new Logger(SchedulingOptimizerService.name);

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
    if (config.lookAheadDays !== undefined) {
      if (typeof config.lookAheadDays !== 'number' || config.lookAheadDays < 1) return false;
    }
    if (config.gapThresholdMins !== undefined) {
      if (typeof config.gapThresholdMins !== 'number' || config.gapThresholdMins < 15) return false;
    }
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    const agentConfig: SchedulingOptimizerConfig = config || {};
    const maxCards = agentConfig.maxCardsPerRun || 5;
    const lookAheadDays = agentConfig.lookAheadDays || 5;
    const gapThresholdMins = agentConfig.gapThresholdMins || 60;

    const gaps = await this.findScheduleGaps(businessId, lookAheadDays, gapThresholdMins);

    if (gaps.length === 0) {
      this.logger.log(`No schedule gaps found for business ${businessId}`);
      return { cardsCreated: 0 };
    }

    // Group gaps by date+staff
    const groupedGaps = this.groupGaps(gaps);
    let cardsCreated = 0;

    for (const group of groupedGaps) {
      if (cardsCreated >= maxCards) break;

      try {
        // Dedup: check for existing pending card for this staff+date
        const existingCard = await this.prisma.actionCard.findFirst({
          where: {
            businessId,
            type: 'SCHEDULE_GAP',
            status: 'PENDING',
            staffId: group.staffId,
            metadata: {
              path: ['date'],
              equals: group.date,
            },
          },
        });

        if (existingCard) continue;

        const totalGapMins = group.gaps.reduce((sum, g) => sum + g.durationMins, 0);

        await this.actionCardService.create({
          businessId,
          type: 'SCHEDULE_GAP',
          category: 'OPPORTUNITY',
          priority: this.calculatePriority(totalGapMins, group.gaps.length),
          title: `Schedule gaps for ${group.staffName} on ${this.formatDate(group.date)}`,
          description: `Because ${group.staffName} has ${group.gaps.length} gap${group.gaps.length > 1 ? 's' : ''} totaling ${totalGapMins} minutes on ${this.formatDate(group.date)}. Consider filling with waitlist customers or walk-ins.`,
          suggestedAction: 'Check waitlist for matching customers or open for walk-ins',
          staffId: group.staffId,
          preview: {
            date: group.date,
            staffName: group.staffName,
            totalGapMins,
            gaps: group.gaps.map((g) => ({
              start: g.gapStart,
              end: g.gapEnd,
              durationMins: g.durationMins,
            })),
          },
          ctaConfig: [
            { label: 'Check Waitlist', action: 'check_waitlist', variant: 'primary' },
            { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
          ],
          metadata: {
            date: group.date,
            staffId: group.staffId,
            totalGapMins,
            gapCount: group.gaps.length,
            source: 'scheduling-optimizer',
          },
        });

        cardsCreated++;
      } catch (err: any) {
        this.logger.warn(
          `Failed to create schedule gap card for ${group.staffName} on ${group.date}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Scheduling optimizer created ${cardsCreated} cards for business ${businessId}`,
    );

    return { cardsCreated };
  }

  async findScheduleGaps(
    businessId: string,
    lookAheadDays: number,
    gapThresholdMins: number,
  ): Promise<ScheduleGap[]> {
    const today = new Date();
    const gaps: ScheduleGap[] = [];

    const staff = await this.prisma.staff.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true },
    });

    for (let dayOffset = 0; dayOffset < lookAheadDays; dayOffset++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      const dateStr = checkDate.toISOString().split('T')[0];
      const dayOfWeek = checkDate.getDay();

      for (const s of staff) {
        try {
          const schedule = await this.getDaySchedule(
            businessId,
            s.id,
            s.name,
            dateStr,
            dayOfWeek,
          );
          if (!schedule) continue;

          const dayGaps = this.findGapsInSchedule(schedule, gapThresholdMins);
          gaps.push(...dayGaps);
        } catch (err: any) {
          this.logger.warn(
            `Failed to check schedule for staff ${s.id} on ${dateStr}: ${err.message}`,
          );
        }
      }
    }

    return gaps;
  }

  async getDaySchedule(
    businessId: string,
    staffId: string,
    staffName: string,
    dateStr: string,
    dayOfWeek: number,
  ): Promise<DaySchedule | null> {
    const wh = await this.prisma.workingHours.findUnique({
      where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
    });

    if (!wh || wh.isOff) return null;

    // Check time off
    const timeOff = await this.prisma.timeOff.findFirst({
      where: {
        staffId,
        startDate: { lte: new Date(dateStr + 'T23:59:59') },
        endDate: { gte: new Date(dateStr + 'T00:00:00') },
      },
    });
    if (timeOff) return null;

    const [startH, startM] = wh.startTime.split(':').map(Number);
    const [endH, endM] = wh.endTime.split(':').map(Number);

    // Get existing bookings
    const dayStart = new Date(dateStr + 'T00:00:00');
    const dayEnd = new Date(dateStr + 'T23:59:59');
    const bookings = await this.prisma.booking.findMany({
      where: {
        businessId,
        staffId,
        status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
      },
      select: { startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    });

    return {
      date: dateStr,
      staffId,
      staffName,
      workStart: startH * 60 + startM,
      workEnd: endH * 60 + endM,
      bookings: bookings.map((b) => {
        const s = new Date(b.startTime);
        const e = new Date(b.endTime);
        return {
          startMins: s.getHours() * 60 + s.getMinutes(),
          endMins: e.getHours() * 60 + e.getMinutes(),
        };
      }),
    };
  }

  findGapsInSchedule(schedule: DaySchedule, gapThresholdMins: number): ScheduleGap[] {
    const gaps: ScheduleGap[] = [];

    if (schedule.bookings.length === 0) {
      // Entire working day is open
      const duration = schedule.workEnd - schedule.workStart;
      if (duration >= gapThresholdMins) {
        gaps.push({
          date: schedule.date,
          staffId: schedule.staffId,
          staffName: schedule.staffName,
          gapStart: this.minsToTime(schedule.workStart),
          gapEnd: this.minsToTime(schedule.workEnd),
          durationMins: duration,
        });
      }
      return gaps;
    }

    // Sort bookings by start time
    const sorted = [...schedule.bookings].sort((a, b) => a.startMins - b.startMins);

    // Gap before first booking
    if (sorted[0].startMins - schedule.workStart >= gapThresholdMins) {
      gaps.push({
        date: schedule.date,
        staffId: schedule.staffId,
        staffName: schedule.staffName,
        gapStart: this.minsToTime(schedule.workStart),
        gapEnd: this.minsToTime(sorted[0].startMins),
        durationMins: sorted[0].startMins - schedule.workStart,
      });
    }

    // Gaps between bookings
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapDuration = sorted[i + 1].startMins - sorted[i].endMins;
      if (gapDuration >= gapThresholdMins) {
        gaps.push({
          date: schedule.date,
          staffId: schedule.staffId,
          staffName: schedule.staffName,
          gapStart: this.minsToTime(sorted[i].endMins),
          gapEnd: this.minsToTime(sorted[i + 1].startMins),
          durationMins: gapDuration,
        });
      }
    }

    // Gap after last booking
    const lastEnd = sorted[sorted.length - 1].endMins;
    if (schedule.workEnd - lastEnd >= gapThresholdMins) {
      gaps.push({
        date: schedule.date,
        staffId: schedule.staffId,
        staffName: schedule.staffName,
        gapStart: this.minsToTime(lastEnd),
        gapEnd: this.minsToTime(schedule.workEnd),
        durationMins: schedule.workEnd - lastEnd,
      });
    }

    return gaps;
  }

  private groupGaps(gaps: ScheduleGap[]): { date: string; staffId: string; staffName: string; gaps: ScheduleGap[] }[] {
    const map = new Map<string, { date: string; staffId: string; staffName: string; gaps: ScheduleGap[] }>();

    for (const gap of gaps) {
      const key = `${gap.date}:${gap.staffId}`;
      if (!map.has(key)) {
        map.set(key, { date: gap.date, staffId: gap.staffId, staffName: gap.staffName, gaps: [] });
      }
      map.get(key)!.gaps.push(gap);
    }

    return Array.from(map.values());
  }

  private calculatePriority(totalGapMins: number, gapCount: number): number {
    // More gap time = higher priority (50-75 range)
    const basePriority = 50;
    const timeBonus = Math.min(15, Math.round(totalGapMins / 30));
    const countBonus = Math.min(10, gapCount * 3);
    return basePriority + timeBonus + countBonus;
  }

  private minsToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }
}
