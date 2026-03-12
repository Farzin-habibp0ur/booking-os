import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateDealDto, UpdateDealDto, ChangeStageDto, CreateActivityDto } from './dto';

const STAGE_PROBABILITY: Record<string, number> = {
  INQUIRY: 10,
  QUALIFIED: 25,
  TEST_DRIVE: 40,
  NEGOTIATION: 60,
  FINANCE: 80,
  CLOSED_WON: 100,
  CLOSED_LOST: 0,
};

const STAGE_ORDER = [
  'INQUIRY',
  'QUALIFIED',
  'TEST_DRIVE',
  'NEGOTIATION',
  'FINANCE',
  'CLOSED_WON',
  'CLOSED_LOST',
];

@Injectable()
export class DealService {
  private readonly logger = new Logger(DealService.name);

  constructor(private prisma: PrismaService) {}

  private async assertDealershipVertical(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (biz?.verticalPack !== 'dealership') {
      throw new ForbiddenException('Deal pipeline is only available for dealership businesses');
    }
  }

  private readonly dealInclude = {
    customer: { select: { id: true, name: true, phone: true, email: true } },
    vehicle: {
      select: {
        id: true,
        stockNumber: true,
        year: true,
        make: true,
        model: true,
        trim: true,
        askingPrice: true,
        status: true,
      },
    },
    assignedTo: { select: { id: true, name: true } },
    _count: { select: { activities: true } },
  };

  async create(businessId: string, data: CreateDealDto, staffId?: string) {
    await this.assertDealershipVertical(businessId);

    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, businessId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (data.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: data.vehicleId, businessId },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }

    if (data.assignedToId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: data.assignedToId, businessId, isActive: true },
      });
      if (!staff) throw new NotFoundException('Staff not found');
    }

    const stage = data.stage || 'INQUIRY';
    const probability = data.probability ?? STAGE_PROBABILITY[stage] ?? 0;

    const deal = await this.prisma.deal.create({
      data: {
        businessId,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        assignedToId: data.assignedToId || staffId,
        stage,
        source: data.source,
        dealType: data.dealType,
        dealValue: data.dealValue,
        tradeInValue: data.tradeInValue,
        probability,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        notes: data.notes,
      },
      include: this.dealInclude,
    });

    // Create initial stage history entry
    await this.prisma.dealStageHistory.create({
      data: {
        dealId: deal.id,
        fromStage: null,
        toStage: stage,
        changedById: staffId,
      },
    });

    return deal;
  }

  async findAll(
    businessId: string,
    query: {
      stage?: string;
      assignedToId?: string;
      customerId?: string;
      skip?: number;
      take?: number;
    },
  ) {
    await this.assertDealershipVertical(businessId);

    const where: any = { businessId };
    if (query.stage) where.stage = query.stage;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.customerId) where.customerId = query.customerId;

    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        include: this.dealInclude,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip || 0,
        take: Math.min(query.take || 50, 200),
      }),
      this.prisma.deal.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(businessId: string, id: string) {
    await this.assertDealershipVertical(businessId);

    const deal = await this.prisma.deal.findFirst({
      where: { id, businessId },
      include: {
        ...this.dealInclude,
        stageHistory: {
          include: { changedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async update(businessId: string, id: string, data: UpdateDealDto) {
    await this.assertDealershipVertical(businessId);

    const deal = await this.prisma.deal.findFirst({ where: { id, businessId } });
    if (!deal) throw new NotFoundException('Deal not found');

    if (data.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: data.vehicleId, businessId },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }

    if (data.assignedToId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: data.assignedToId, businessId, isActive: true },
      });
      if (!staff) throw new NotFoundException('Staff not found');
    }

    return this.prisma.deal.update({
      where: { id },
      data: {
        ...data,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
      },
      include: this.dealInclude,
    });
  }

  async changeStage(businessId: string, id: string, data: ChangeStageDto, staffId?: string) {
    await this.assertDealershipVertical(businessId);

    const deal = await this.prisma.deal.findFirst({
      where: { id, businessId },
      include: { stageHistory: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    if (deal.stage === data.stage) {
      throw new BadRequestException('Deal is already at this stage');
    }

    // Calculate duration in previous stage
    const lastHistory = deal.stageHistory[0];
    const duration = lastHistory
      ? Math.floor((Date.now() - lastHistory.createdAt.getTime()) / (1000 * 60))
      : undefined;

    const probability = STAGE_PROBABILITY[data.stage] ?? deal.probability;
    const updateData: any = {
      stage: data.stage,
      probability,
    };

    if (data.stage === 'CLOSED_WON') {
      updateData.actualCloseDate = new Date();
    }
    if (data.stage === 'CLOSED_LOST') {
      updateData.actualCloseDate = new Date();
      if (data.lostReason) updateData.lostReason = data.lostReason;
    }

    const [updatedDeal] = await Promise.all([
      this.prisma.deal.update({
        where: { id },
        data: updateData,
        include: this.dealInclude,
      }),
      this.prisma.dealStageHistory.create({
        data: {
          dealId: id,
          fromStage: deal.stage,
          toStage: data.stage,
          changedById: staffId,
          duration,
          notes: data.notes,
        },
      }),
    ]);

    // On CLOSED_WON: mark vehicle as SOLD
    if (data.stage === 'CLOSED_WON' && deal.vehicleId) {
      this.prisma.vehicle
        .update({
          where: { id: deal.vehicleId },
          data: { status: 'SOLD', soldAt: new Date() },
        })
        .catch((err) =>
          this.logger.warn(`Failed to update vehicle status on deal won`, { error: err.message }),
        );
    }

    return updatedDeal;
  }

  async pipeline(businessId: string) {
    await this.assertDealershipVertical(businessId);

    const deals = await this.prisma.deal.findMany({
      where: { businessId, stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } },
      include: this.dealInclude,
      orderBy: { updatedAt: 'desc' },
    });

    const grouped: Record<string, any[]> = {};
    for (const stage of STAGE_ORDER.filter((s) => s !== 'CLOSED_WON' && s !== 'CLOSED_LOST')) {
      grouped[stage] = [];
    }
    for (const deal of deals) {
      if (grouped[deal.stage]) {
        grouped[deal.stage].push(deal);
      }
    }

    // Calculate totals per stage
    const stageTotals: Record<string, { count: number; value: number }> = {};
    for (const [stage, stageDeals] of Object.entries(grouped)) {
      stageTotals[stage] = {
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + (d.dealValue ? Number(d.dealValue) : 0), 0),
      };
    }

    return { stages: grouped, stageTotals, totalDeals: deals.length };
  }

  async stats(businessId: string) {
    await this.assertDealershipVertical(businessId);

    const [allDeals, stageHistory] = await Promise.all([
      this.prisma.deal.findMany({
        where: { businessId },
        select: {
          stage: true,
          dealValue: true,
          probability: true,
          createdAt: true,
          actualCloseDate: true,
        },
      }),
      this.prisma.dealStageHistory.findMany({
        where: { deal: { businessId } },
        select: { fromStage: true, toStage: true, duration: true },
      }),
    ]);

    // Value by stage
    const valueByStage: Record<string, number> = {};
    let totalPipelineValue = 0;
    let weightedPipelineValue = 0;

    for (const d of allDeals) {
      const value = d.dealValue ? Number(d.dealValue) : 0;
      valueByStage[d.stage] = (valueByStage[d.stage] || 0) + value;
      if (d.stage !== 'CLOSED_WON' && d.stage !== 'CLOSED_LOST') {
        totalPipelineValue += value;
        weightedPipelineValue += value * ((d.probability || 0) / 100);
      }
    }

    // Win/loss ratio
    const won = allDeals.filter((d) => d.stage === 'CLOSED_WON').length;
    const lost = allDeals.filter((d) => d.stage === 'CLOSED_LOST').length;
    const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    // Avg time per stage (from stage history)
    const stageTimeTotals: Record<string, { totalMins: number; count: number }> = {};
    for (const h of stageHistory) {
      if (h.fromStage && h.duration != null) {
        if (!stageTimeTotals[h.fromStage])
          stageTimeTotals[h.fromStage] = { totalMins: 0, count: 0 };
        stageTimeTotals[h.fromStage].totalMins += h.duration;
        stageTimeTotals[h.fromStage].count++;
      }
    }
    const avgTimePerStage: Record<string, number> = {};
    for (const [stage, data] of Object.entries(stageTimeTotals)) {
      avgTimePerStage[stage] = Math.round(data.totalMins / data.count);
    }

    // Avg cycle time (for closed deals)
    const closedDeals = allDeals.filter((d) => d.actualCloseDate && d.stage === 'CLOSED_WON');
    const avgCycleTime =
      closedDeals.length > 0
        ? Math.round(
            closedDeals.reduce((sum, d) => {
              const days = Math.floor(
                (new Date(d.actualCloseDate!).getTime() - new Date(d.createdAt).getTime()) /
                  (1000 * 60 * 60 * 24),
              );
              return sum + days;
            }, 0) / closedDeals.length,
          )
        : 0;

    // Conversion rates between stages
    const conversionRates: Record<string, number> = {};
    for (let i = 0; i < STAGE_ORDER.length - 2; i++) {
      const from = STAGE_ORDER[i];
      const to = STAGE_ORDER[i + 1];
      const transitionsFrom = stageHistory.filter((h) => h.fromStage === from).length;
      const transitionsTo = stageHistory.filter(
        (h) => h.fromStage === from && h.toStage === to,
      ).length;
      conversionRates[`${from}_to_${to}`] =
        transitionsFrom > 0 ? Math.round((transitionsTo / transitionsFrom) * 100) : 0;
    }

    return {
      totalDeals: allDeals.length,
      totalPipelineValue: Math.round(totalPipelineValue * 100) / 100,
      weightedPipelineValue: Math.round(weightedPipelineValue * 100) / 100,
      valueByStage,
      won,
      lost,
      winRate,
      avgCycleTime,
      avgTimePerStage,
      conversionRates,
    };
  }

  async addActivity(businessId: string, dealId: string, data: CreateActivityDto, staffId?: string) {
    await this.assertDealershipVertical(businessId);

    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, businessId } });
    if (!deal) throw new NotFoundException('Deal not found');

    return this.prisma.dealActivity.create({
      data: {
        dealId,
        type: data.type,
        description: data.description,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        createdById: staffId,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async getActivities(businessId: string, dealId: string) {
    await this.assertDealershipVertical(businessId);

    const deal = await this.prisma.deal.findFirst({ where: { id: dealId, businessId } });
    if (!deal) throw new NotFoundException('Deal not found');

    return this.prisma.dealActivity.findMany({
      where: { dealId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Called when a test drive booking completes — auto-advance deal if at early stage */
  async advanceDealOnTestDriveCompletion(customerId: string, bookingId: string) {
    // Find deals for this customer that are at INQUIRY or QUALIFIED stage
    const deals = await this.prisma.deal.findMany({
      where: {
        customerId,
        stage: { in: ['INQUIRY', 'QUALIFIED'] },
      },
      include: { stageHistory: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    for (const deal of deals) {
      const lastHistory = deal.stageHistory[0];
      const duration = lastHistory
        ? Math.floor((Date.now() - lastHistory.createdAt.getTime()) / (1000 * 60))
        : undefined;

      await Promise.all([
        this.prisma.deal.update({
          where: { id: deal.id },
          data: { stage: 'TEST_DRIVE', probability: STAGE_PROBABILITY['TEST_DRIVE'] },
        }),
        this.prisma.dealStageHistory.create({
          data: {
            dealId: deal.id,
            fromStage: deal.stage,
            toStage: 'TEST_DRIVE',
            duration,
            notes: `Auto-advanced: test drive booking completed`,
          },
        }),
        this.prisma.dealActivity.create({
          data: {
            dealId: deal.id,
            type: 'TEST_DRIVE',
            description: `Test drive completed (booking ${bookingId})`,
            completedAt: new Date(),
          },
        }),
      ]);

      this.logger.log(
        `Auto-advanced deal ${deal.id} to TEST_DRIVE stage after test drive completion`,
      );
    }
  }
}
