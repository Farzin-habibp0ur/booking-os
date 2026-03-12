import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DealService } from './deal.service';
import { PrismaService } from '../../common/prisma.service';

describe('DealService', () => {
  let service: DealService;
  let prisma: PrismaService;

  const businessId = 'biz-1';
  const staffId = 'staff-1';
  const customerId = 'cust-1';
  const vehicleId = 'veh-1';
  const dealId = 'deal-1';

  const mockDeal = {
    id: dealId,
    businessId,
    customerId,
    vehicleId,
    assignedToId: staffId,
    stage: 'INQUIRY',
    probability: 10,
    dealValue: 25000,
    source: 'WALK_IN',
    dealType: 'NEW_PURCHASE',
    tradeInValue: null,
    expectedCloseDate: null,
    actualCloseDate: null,
    lostReason: null,
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    customer: { id: customerId, name: 'John Doe', phone: '555-0001', email: 'john@test.com' },
    vehicle: {
      id: vehicleId,
      stockNumber: 'STK001',
      year: 2025,
      make: 'Toyota',
      model: 'Camry',
      trim: 'SE',
      askingPrice: 30000,
      status: 'IN_STOCK',
    },
    assignedTo: { id: staffId, name: 'Agent Smith' },
    _count: { activities: 3 },
  };

  const mockDealership = { verticalPack: 'dealership' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealService,
        {
          provide: PrismaService,
          useValue: {
            business: { findUnique: jest.fn().mockResolvedValue(mockDealership) },
            deal: {
              create: jest.fn().mockResolvedValue(mockDeal),
              findMany: jest.fn().mockResolvedValue([mockDeal]),
              findFirst: jest.fn().mockResolvedValue(mockDeal),
              update: jest.fn().mockResolvedValue(mockDeal),
              count: jest.fn().mockResolvedValue(1),
            },
            customer: { findFirst: jest.fn().mockResolvedValue({ id: customerId }) },
            vehicle: {
              findFirst: jest.fn().mockResolvedValue({ id: vehicleId }),
              update: jest.fn().mockResolvedValue({}),
            },
            staff: { findFirst: jest.fn().mockResolvedValue({ id: staffId }) },
            dealStageHistory: {
              create: jest.fn().mockResolvedValue({}),
              findMany: jest.fn().mockResolvedValue([]),
            },
            dealActivity: {
              create: jest.fn().mockResolvedValue({
                id: 'act-1',
                type: 'NOTE',
                description: 'Test',
                createdBy: { id: staffId, name: 'Agent Smith' },
              }),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    service = module.get<DealService>(DealService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  // -------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------
  describe('create', () => {
    const dto = {
      customerId,
      vehicleId,
      source: 'WALK_IN',
      dealType: 'NEW_PURCHASE',
      dealValue: 25000,
    };

    it('should create a deal successfully', async () => {
      const result = await service.create(businessId, dto as any, staffId);

      expect(result).toEqual(mockDeal);
      expect(prisma.business.findUnique).toHaveBeenCalledWith({
        where: { id: businessId },
        select: { verticalPack: true },
      });
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: customerId, businessId, deletedAt: null },
      });
      expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({
        where: { id: vehicleId, businessId },
      });
      expect(prisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId,
            customerId,
            vehicleId,
            stage: 'INQUIRY',
            probability: 10,
          }),
        }),
      );
      expect(prisma.dealStageHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dealId: dealId,
          fromStage: null,
          toStage: 'INQUIRY',
          changedById: staffId,
        }),
      });
    });

    it('should throw NotFoundException when customer not found', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(businessId, dto as any, staffId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(businessId, dto as any, staffId)).rejects.toThrow(
        'Customer not found',
      );
    });

    it('should throw NotFoundException when vehicle not found', async () => {
      (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.create(businessId, dto as any, staffId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(businessId, dto as any, staffId)).rejects.toThrow(
        'Vehicle not found',
      );
    });

    it('should throw ForbiddenException for non-dealership vertical', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({ verticalPack: 'aesthetic' });

      await expect(service.create(businessId, dto as any, staffId)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(businessId, dto as any, staffId)).rejects.toThrow(
        'Deal pipeline is only available for dealership businesses',
      );
    });

    it('should use default stage INQUIRY when not specified', async () => {
      const dtoNoStage = { customerId };
      await service.create(businessId, dtoNoStage as any, staffId);

      expect(prisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ stage: 'INQUIRY', probability: 10 }),
        }),
      );
    });

    it('should skip vehicle validation when vehicleId not provided', async () => {
      const dtoNoVehicle = { customerId };
      await service.create(businessId, dtoNoVehicle as any, staffId);

      expect(prisma.vehicle.findFirst).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when staff not found', async () => {
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue(null);
      const dtoWithStaff = { customerId, assignedToId: 'bad-staff' };

      await expect(service.create(businessId, dtoWithStaff as any, staffId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(businessId, dtoWithStaff as any, staffId)).rejects.toThrow(
        'Staff not found',
      );
    });
  });

  // -------------------------------------------------------------------
  // findAll
  // -------------------------------------------------------------------
  describe('findAll', () => {
    it('should return paginated deals with filters', async () => {
      const result = await service.findAll(businessId, { stage: 'INQUIRY', assignedToId: staffId });

      expect(result).toEqual({ data: [mockDeal], total: 1 });
      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId, stage: 'INQUIRY', assignedToId: staffId },
          orderBy: { updatedAt: 'desc' },
        }),
      );
    });

    it('should filter by businessId for tenant isolation', async () => {
      await service.findAll(businessId, {});

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId },
        }),
      );
    });

    it('should cap take at 200', async () => {
      await service.findAll(businessId, { take: 500 });

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200,
        }),
      );
    });

    it('should default take to 50 and skip to 0', async () => {
      await service.findAll(businessId, {});

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        }),
      );
    });
  });

  // -------------------------------------------------------------------
  // findOne
  // -------------------------------------------------------------------
  describe('findOne', () => {
    it('should return a deal with stage history and activities', async () => {
      const detailedDeal = { ...mockDeal, stageHistory: [], activities: [] };
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(detailedDeal);

      const result = await service.findOne(businessId, dealId);

      expect(result).toEqual(detailedDeal);
      expect(prisma.deal.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: dealId, businessId },
          include: expect.objectContaining({
            stageHistory: expect.any(Object),
            activities: expect.any(Object),
          }),
        }),
      );
    });

    it('should throw NotFoundException when deal not found', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(businessId, 'nonexistent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne(businessId, 'nonexistent')).rejects.toThrow('Deal not found');
    });
  });

  // -------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------
  describe('update', () => {
    it('should update a deal successfully', async () => {
      const updateDto = { dealValue: 30000, notes: 'Updated' };
      const updatedDeal = { ...mockDeal, ...updateDto };
      (prisma.deal.update as jest.Mock).mockResolvedValue(updatedDeal);

      const result = await service.update(businessId, dealId, updateDto as any);

      expect(result).toEqual(updatedDeal);
      expect(prisma.deal.findFirst).toHaveBeenCalledWith({
        where: { id: dealId, businessId },
      });
      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: dealId },
        data: expect.objectContaining({ dealValue: 30000, notes: 'Updated' }),
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when deal not found', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.update(businessId, 'nonexistent', {} as any)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update(businessId, 'nonexistent', {} as any)).rejects.toThrow(
        'Deal not found',
      );
    });

    it('should validate vehicle if vehicleId provided', async () => {
      (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(businessId, dealId, { vehicleId: 'bad-veh' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate staff if assignedToId provided', async () => {
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(businessId, dealId, { assignedToId: 'bad-staff' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------
  // changeStage
  // -------------------------------------------------------------------
  describe('changeStage', () => {
    const dealWithHistory = {
      ...mockDeal,
      stage: 'INQUIRY',
      stageHistory: [{ createdAt: new Date('2026-01-01') }],
    };

    beforeEach(() => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(dealWithHistory);
      (prisma.deal.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        stage: 'QUALIFIED',
        probability: 25,
      });
    });

    it('should change stage successfully', async () => {
      const result = await service.changeStage(
        businessId,
        dealId,
        { stage: 'QUALIFIED' } as any,
        staffId,
      );

      expect(result).toBeDefined();
      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: dealId },
          data: expect.objectContaining({ stage: 'QUALIFIED', probability: 25 }),
        }),
      );
      expect(prisma.dealStageHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dealId,
          fromStage: 'INQUIRY',
          toStage: 'QUALIFIED',
          changedById: staffId,
        }),
      });
    });

    it('should throw BadRequestException when already at stage', async () => {
      await expect(
        service.changeStage(businessId, dealId, { stage: 'INQUIRY' } as any, staffId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changeStage(businessId, dealId, { stage: 'INQUIRY' } as any, staffId),
      ).rejects.toThrow('Deal is already at this stage');
    });

    it('should set actualCloseDate on CLOSED_WON', async () => {
      const wonDeal = { ...mockDeal, stage: 'CLOSED_WON', probability: 100, vehicleId };
      (prisma.deal.update as jest.Mock).mockResolvedValue(wonDeal);

      await service.changeStage(businessId, dealId, { stage: 'CLOSED_WON' } as any, staffId);

      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: 'CLOSED_WON',
            probability: 100,
            actualCloseDate: expect.any(Date),
          }),
        }),
      );
    });

    it('should mark vehicle SOLD on CLOSED_WON when vehicle exists', async () => {
      const dealWithVehicle = { ...dealWithHistory, vehicleId };
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(dealWithVehicle);
      (prisma.vehicle.update as jest.Mock).mockResolvedValue({});

      await service.changeStage(businessId, dealId, { stage: 'CLOSED_WON' } as any, staffId);

      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: vehicleId },
        data: { status: 'SOLD', soldAt: expect.any(Date) },
      });
    });

    it('should set lostReason on CLOSED_LOST', async () => {
      const lostDeal = { ...mockDeal, stage: 'CLOSED_LOST', probability: 0 };
      (prisma.deal.update as jest.Mock).mockResolvedValue(lostDeal);

      await service.changeStage(
        businessId,
        dealId,
        { stage: 'CLOSED_LOST', lostReason: 'Price too high' } as any,
        staffId,
      );

      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: 'CLOSED_LOST',
            probability: 0,
            actualCloseDate: expect.any(Date),
            lostReason: 'Price too high',
          }),
        }),
      );
    });

    it('should throw NotFoundException when deal not found', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.changeStage(businessId, 'nonexistent', { stage: 'QUALIFIED' } as any, staffId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------
  // pipeline
  // -------------------------------------------------------------------
  describe('pipeline', () => {
    it('should return grouped deals by active stages', async () => {
      const deals = [
        { ...mockDeal, stage: 'INQUIRY', dealValue: 20000 },
        { ...mockDeal, id: 'deal-2', stage: 'INQUIRY', dealValue: 15000 },
        { ...mockDeal, id: 'deal-3', stage: 'NEGOTIATION', dealValue: 30000 },
      ];
      (prisma.deal.findMany as jest.Mock).mockResolvedValue(deals);

      const result = await service.pipeline(businessId);

      expect(result.totalDeals).toBe(3);
      expect(result.stages['INQUIRY']).toHaveLength(2);
      expect(result.stages['NEGOTIATION']).toHaveLength(1);
      expect(result.stages['QUALIFIED']).toHaveLength(0);
      expect(result.stageTotals['INQUIRY']).toEqual({ count: 2, value: 35000 });
      expect(result.stageTotals['NEGOTIATION']).toEqual({ count: 1, value: 30000 });
      // Closed stages should not be in result
      expect(result.stages['CLOSED_WON']).toBeUndefined();
      expect(result.stages['CLOSED_LOST']).toBeUndefined();
    });

    it('should exclude CLOSED_WON and CLOSED_LOST from pipeline', async () => {
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([]);

      await service.pipeline(businessId);

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId, stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } },
        }),
      );
    });
  });

  // -------------------------------------------------------------------
  // stats
  // -------------------------------------------------------------------
  describe('stats', () => {
    it('should return win rate, cycle time, and pipeline values', async () => {
      const now = new Date('2026-03-01');
      const deals = [
        {
          stage: 'CLOSED_WON',
          dealValue: 25000,
          probability: 100,
          createdAt: new Date('2026-01-01'),
          actualCloseDate: new Date('2026-02-01'),
        },
        {
          stage: 'CLOSED_WON',
          dealValue: 30000,
          probability: 100,
          createdAt: new Date('2026-01-15'),
          actualCloseDate: new Date('2026-02-15'),
        },
        {
          stage: 'CLOSED_LOST',
          dealValue: 20000,
          probability: 0,
          createdAt: new Date('2026-01-10'),
          actualCloseDate: new Date('2026-02-10'),
        },
        {
          stage: 'NEGOTIATION',
          dealValue: 35000,
          probability: 60,
          createdAt: new Date('2026-02-01'),
          actualCloseDate: null,
        },
      ];
      const stageHistory = [
        { fromStage: 'INQUIRY', toStage: 'QUALIFIED', duration: 120 },
        { fromStage: 'INQUIRY', toStage: 'QUALIFIED', duration: 180 },
        { fromStage: 'QUALIFIED', toStage: 'TEST_DRIVE', duration: 60 },
      ];

      (prisma.deal.findMany as jest.Mock).mockResolvedValue(deals);
      (prisma.dealStageHistory.findMany as jest.Mock).mockResolvedValue(stageHistory);

      const result = await service.stats(businessId);

      expect(result.totalDeals).toBe(4);
      expect(result.won).toBe(2);
      expect(result.lost).toBe(1);
      expect(result.winRate).toBe(67); // 2 / (2 + 1) * 100 = 67
      expect(result.totalPipelineValue).toBe(35000); // only NEGOTIATION is in pipeline
      expect(result.weightedPipelineValue).toBe(21000); // 35000 * 0.6
      expect(result.avgTimePerStage['INQUIRY']).toBe(150); // (120 + 180) / 2
      expect(result.avgTimePerStage['QUALIFIED']).toBe(60);
      expect(result.avgCycleTime).toBeGreaterThan(0);
      expect(result.conversionRates).toBeDefined();
    });

    it('should return 0 win rate when no closed deals', async () => {
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([
        {
          stage: 'INQUIRY',
          dealValue: 10000,
          probability: 10,
          createdAt: new Date(),
          actualCloseDate: null,
        },
      ]);
      (prisma.dealStageHistory.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.stats(businessId);

      expect(result.winRate).toBe(0);
      expect(result.avgCycleTime).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // addActivity
  // -------------------------------------------------------------------
  describe('addActivity', () => {
    it('should add an activity to a deal', async () => {
      const dto = { type: 'NOTE', description: 'Customer called' };

      const result = await service.addActivity(businessId, dealId, dto as any, staffId);

      expect(result).toBeDefined();
      expect(prisma.deal.findFirst).toHaveBeenCalledWith({
        where: { id: dealId, businessId },
      });
      expect(prisma.dealActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dealId,
          type: 'NOTE',
          description: 'Customer called',
          createdById: staffId,
        }),
        include: { createdBy: { select: { id: true, name: true } } },
      });
    });

    it('should throw NotFoundException when deal not found', async () => {
      (prisma.deal.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addActivity(
          businessId,
          'nonexistent',
          { type: 'NOTE', description: 'test' } as any,
          staffId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.addActivity(
          businessId,
          'nonexistent',
          { type: 'NOTE', description: 'test' } as any,
          staffId,
        ),
      ).rejects.toThrow('Deal not found');
    });
  });

  // -------------------------------------------------------------------
  // advanceDealOnTestDriveCompletion
  // -------------------------------------------------------------------
  describe('advanceDealOnTestDriveCompletion', () => {
    it('should advance INQUIRY and QUALIFIED deals to TEST_DRIVE', async () => {
      const dealsToAdvance = [
        {
          id: 'deal-a',
          stage: 'INQUIRY',
          customerId,
          stageHistory: [{ createdAt: new Date('2026-01-01') }],
        },
        {
          id: 'deal-b',
          stage: 'QUALIFIED',
          customerId,
          stageHistory: [{ createdAt: new Date('2026-02-01') }],
        },
      ];
      (prisma.deal.findMany as jest.Mock).mockResolvedValue(dealsToAdvance);

      await service.advanceDealOnTestDriveCompletion(customerId, 'booking-1');

      expect(prisma.deal.findMany).toHaveBeenCalledWith({
        where: {
          customerId,
          stage: { in: ['INQUIRY', 'QUALIFIED'] },
        },
        include: { stageHistory: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

      // Should update both deals
      expect(prisma.deal.update).toHaveBeenCalledTimes(2);
      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-a' },
        data: { stage: 'TEST_DRIVE', probability: 40 },
      });
      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-b' },
        data: { stage: 'TEST_DRIVE', probability: 40 },
      });

      // Should create stage history for both
      expect(prisma.dealStageHistory.create).toHaveBeenCalledTimes(2);

      // Should create activity for both
      expect(prisma.dealActivity.create).toHaveBeenCalledTimes(2);
      expect(prisma.dealActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dealId: 'deal-a',
          type: 'TEST_DRIVE',
          description: 'Test drive completed (booking booking-1)',
        }),
      });
    });

    it('should do nothing when no matching deals found', async () => {
      (prisma.deal.findMany as jest.Mock).mockResolvedValue([]);

      await service.advanceDealOnTestDriveCompletion(customerId, 'booking-1');

      expect(prisma.deal.update).not.toHaveBeenCalled();
      expect(prisma.dealStageHistory.create).not.toHaveBeenCalled();
    });
  });
});
