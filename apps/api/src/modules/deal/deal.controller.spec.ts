import { Test, TestingModule } from '@nestjs/testing';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';

describe('DealController', () => {
  let controller: DealController;
  let service: DealService;

  const businessId = 'biz-1';
  const dealId = 'deal-1';
  const user = { id: 'staff-1' };

  const mockDeal = { id: dealId, businessId, stage: 'INQUIRY' };
  const mockPipeline = { stages: {}, stageTotals: {}, totalDeals: 0 };
  const mockStats = { totalDeals: 5, winRate: 60, won: 3, lost: 2 };
  const mockActivity = { id: 'act-1', type: 'NOTE', description: 'Test' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DealController],
      providers: [
        {
          provide: DealService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockDeal),
            findAll: jest.fn().mockResolvedValue({ data: [mockDeal], total: 1 }),
            findOne: jest.fn().mockResolvedValue(mockDeal),
            update: jest.fn().mockResolvedValue(mockDeal),
            changeStage: jest.fn().mockResolvedValue(mockDeal),
            pipeline: jest.fn().mockResolvedValue(mockPipeline),
            stats: jest.fn().mockResolvedValue(mockStats),
            addActivity: jest.fn().mockResolvedValue(mockActivity),
            getActivities: jest.fn().mockResolvedValue([mockActivity]),
          },
        },
      ],
    }).compile();

    controller = module.get<DealController>(DealController);
    service = module.get<DealService>(DealService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to service.create with businessId, body, and user.id', async () => {
      const body = { customerId: 'cust-1', dealValue: 25000 };

      const result = await controller.create(businessId, body as any, user);

      expect(result).toEqual(mockDeal);
      expect(service.create).toHaveBeenCalledWith(businessId, body, user.id);
    });
  });

  describe('pipeline', () => {
    it('should delegate to service.pipeline with businessId', async () => {
      const result = await controller.pipeline(businessId);

      expect(result).toEqual(mockPipeline);
      expect(service.pipeline).toHaveBeenCalledWith(businessId);
    });
  });

  describe('stats', () => {
    it('should delegate to service.stats with businessId', async () => {
      const result = await controller.stats(businessId);

      expect(result).toEqual(mockStats);
      expect(service.stats).toHaveBeenCalledWith(businessId);
    });
  });

  describe('findAll', () => {
    it('should delegate to service.findAll with businessId and query params', async () => {
      const result = await controller.findAll(businessId, 'INQUIRY', 'staff-1', 'cust-1');

      expect(result).toEqual({ data: [mockDeal], total: 1 });
      expect(service.findAll).toHaveBeenCalledWith(businessId, {
        stage: 'INQUIRY',
        assignedToId: 'staff-1',
        customerId: 'cust-1',
      });
    });
  });

  describe('findOne', () => {
    it('should delegate to service.findOne with businessId and id', async () => {
      const result = await controller.findOne(businessId, dealId);

      expect(result).toEqual(mockDeal);
      expect(service.findOne).toHaveBeenCalledWith(businessId, dealId);
    });
  });

  describe('update', () => {
    it('should delegate to service.update with businessId, id, and body', async () => {
      const body = { dealValue: 30000 };

      const result = await controller.update(businessId, dealId, body as any);

      expect(result).toEqual(mockDeal);
      expect(service.update).toHaveBeenCalledWith(businessId, dealId, body);
    });
  });

  describe('changeStage', () => {
    it('should delegate to service.changeStage with businessId, id, body, and user.id', async () => {
      const body = { stage: 'QUALIFIED' };

      const result = await controller.changeStage(businessId, dealId, body as any, user);

      expect(result).toEqual(mockDeal);
      expect(service.changeStage).toHaveBeenCalledWith(businessId, dealId, body, user.id);
    });
  });

  describe('addActivity', () => {
    it('should delegate to service.addActivity with businessId, dealId, body, and user.id', async () => {
      const body = { type: 'NOTE', description: 'Customer called' };

      const result = await controller.addActivity(businessId, dealId, body as any, user);

      expect(result).toEqual(mockActivity);
      expect(service.addActivity).toHaveBeenCalledWith(businessId, dealId, body, user.id);
    });
  });

  describe('getActivities', () => {
    it('should delegate to service.getActivities with businessId and dealId', async () => {
      const result = await controller.getActivities(businessId, dealId);

      expect(result).toEqual([mockActivity]);
      expect(service.getActivities).toHaveBeenCalledWith(businessId, dealId);
    });
  });
});
