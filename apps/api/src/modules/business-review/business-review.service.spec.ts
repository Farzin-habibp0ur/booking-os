import { Test, TestingModule } from '@nestjs/testing';
import { BusinessReviewService } from './business-review.service';
import { PrismaService } from '../../common/prisma.service';
import { ClaudeClient } from '../ai/claude.client';

describe('BusinessReviewService', () => {
  let service: BusinessReviewService;
  let prisma: any;
  let claude: any;

  const BID = 'biz-1';
  const MONTH = '2027-01';

  beforeEach(async () => {
    prisma = {
      businessReview: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      business: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Test Clinic', verticalPack: 'AESTHETIC' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      booking: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      customer: {
        count: jest.fn().mockResolvedValue(0),
      },
      actionCard: {
        count: jest.fn().mockResolvedValue(0),
      },
      contentDraft: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    claude = {
      isAvailable: jest.fn().mockReturnValue(true),
      complete: jest.fn().mockResolvedValue(
        'Great month overall.\n\nBookings were strong.\n\nRECOMMENDATIONS_JSON:\n[{"title":"Boost marketing","description":"Run a campaign","link":"/campaigns"},{"title":"Reduce no-shows","description":"Send reminders","link":"/settings"},{"title":"Add services","description":"Expand offerings","link":"/services"}]',
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessReviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClaudeClient, useValue: claude },
      ],
    }).compile();

    service = module.get(BusinessReviewService);
  });

  describe('getReview', () => {
    it('returns cached review if exists', async () => {
      const cached = { id: 'rev-1', month: MONTH, metrics: {}, aiSummary: 'cached' };
      prisma.businessReview.findUnique.mockResolvedValue(cached);

      const result = await service.getReview(BID, MONTH);
      expect(result).toBe(cached);
      expect(claude.complete).not.toHaveBeenCalled();
    });

    it('generates review if not cached', async () => {
      prisma.businessReview.findUnique.mockResolvedValue(null);
      prisma.businessReview.create.mockResolvedValue({ id: 'rev-new', month: MONTH });

      const result = await service.getReview(BID, MONTH);
      expect(prisma.businessReview.create).toHaveBeenCalled();
      expect(result.id).toBe('rev-new');
    });
  });

  describe('listReviews', () => {
    it('returns reviews ordered by month desc', async () => {
      prisma.businessReview.findMany.mockResolvedValue([{ month: '2027-02' }, { month: '2027-01' }]);

      const result = await service.listReviews(BID);
      expect(prisma.businessReview.findMany).toHaveBeenCalledWith({
        where: { businessId: BID },
        orderBy: { month: 'desc' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('generateReview', () => {
    it('calls Claude API with metrics and stores result', async () => {
      prisma.businessReview.create.mockImplementation(({ data }: any) => ({
        id: 'rev-1',
        ...data,
      }));

      const result = await service.generateReview(BID, MONTH);

      expect(claude.complete).toHaveBeenCalledWith(
        'sonnet',
        expect.stringContaining('business analytics assistant'),
        expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
        ]),
        1500,
      );
      expect(prisma.businessReview.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: BID,
          month: MONTH,
          metrics: expect.any(Object),
          aiSummary: expect.any(String),
        }),
      });
      expect(result.aiSummary).toContain('Great month');
    });

    it('handles Claude API failure gracefully', async () => {
      claude.complete.mockRejectedValue(new Error('API error'));
      prisma.businessReview.create.mockImplementation(({ data }: any) => ({
        id: 'rev-1',
        ...data,
      }));

      const result = await service.generateReview(BID, MONTH);
      expect(result.aiSummary).toContain('temporarily unavailable');
    });

    it('handles Claude not available', async () => {
      claude.isAvailable.mockReturnValue(false);
      prisma.businessReview.create.mockImplementation(({ data }: any) => ({
        id: 'rev-1',
        ...data,
      }));

      const result = await service.generateReview(BID, MONTH);
      expect(result.aiSummary).toContain('not available');
      expect(claude.complete).not.toHaveBeenCalled();
    });
  });

  describe('aggregateMetrics', () => {
    it('returns correct metric structure', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(50)  // total
        .mockResolvedValueOnce(40)  // completed
        .mockResolvedValueOnce(3);  // no-shows

      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.groupBy.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(5);

      const metrics = await service.aggregateMetrics(BID, MONTH);

      expect(metrics).toEqual(
        expect.objectContaining({
          totalBookings: 50,
          completedBookings: 40,
          noShowCount: 3,
          noShowRate: expect.any(Number),
          totalRevenue: expect.any(Number),
          avgBookingValue: expect.any(Number),
          revenueChange: expect.any(Number),
          newCustomers: 5,
          topServices: expect.any(Array),
          topStaff: expect.any(Array),
          busiestDays: expect.any(Array),
          busiestHours: expect.any(Array),
          aiStats: expect.objectContaining({
            actionCardsCreated: expect.any(Number),
          }),
          contentStats: expect.objectContaining({
            published: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe('generateMonthlyReviews (cron)', () => {
    it('generates reviews for active businesses only', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'biz-1', name: 'Active Clinic' },
        { id: 'biz-2', name: 'Another Clinic' },
      ]);
      prisma.businessReview.findUnique.mockResolvedValue(null);
      prisma.businessReview.create.mockImplementation(({ data }: any) => ({
        id: 'rev-new',
        ...data,
      }));

      await service.generateMonthlyReviews();

      expect(prisma.business.findMany).toHaveBeenCalledWith({
        where: {
          subscription: { status: { in: ['ACTIVE', 'TRIALING'] } },
        },
        select: { id: true, name: true },
      });
      // Should attempt to create for each business
      expect(prisma.businessReview.create).toHaveBeenCalledTimes(2);
    });

    it('skips businesses that already have a review', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'biz-1', name: 'Already Reviewed' },
      ]);
      prisma.businessReview.findUnique.mockResolvedValue({ id: 'existing' });

      await service.generateMonthlyReviews();

      expect(prisma.businessReview.create).not.toHaveBeenCalled();
    });
  });
});
