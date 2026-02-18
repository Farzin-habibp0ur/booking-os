import { Test } from '@nestjs/testing';
import { OpportunityDetectorService } from './opportunity-detector.service';
import { PrismaService } from '../../common/prisma.service';
import { ActionCardService } from '../action-card/action-card.service';
import { createMockPrisma } from '../../test/mocks';

describe('OpportunityDetectorService', () => {
  let service: OpportunityDetectorService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let actionCardService: { create: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    actionCardService = { create: jest.fn().mockResolvedValue({ id: 'card-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        OpportunityDetectorService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActionCardService, useValue: actionCardService },
      ],
    }).compile();

    service = module.get(OpportunityDetectorService);
  });

  describe('detectForBusiness', () => {
    const bizId = 'biz-1';

    beforeEach(() => {
      // Default: no existing cards
      prisma.actionCard.findMany.mockResolvedValue([]);
    });

    it('creates deposit pending cards for bookings needing deposit', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      prisma.booking.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            startTime: tomorrow,
            status: 'PENDING_DEPOSIT',
            customer: { id: 'c1', name: 'Emma' },
            service: { name: 'Botox' },
            staffId: 's1',
          },
        ] as any)
        .mockResolvedValueOnce([] as any); // tomorrow bookings
      prisma.conversation.findMany.mockResolvedValue([] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);

      const count = await service.detectForBusiness(bizId);

      expect(count).toBe(1);
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: bizId,
          type: 'DEPOSIT_PENDING',
          bookingId: 'b1',
          customerId: 'c1',
        }),
      );
    });

    it('creates overdue reply cards for stale conversations', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      prisma.booking.findMany.mockResolvedValue([] as any);
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          lastMessageAt: twoHoursAgo,
          customer: { id: 'c2', name: 'James' },
          assignedTo: { name: 'Maria' },
          assignedToId: 's2',
        },
      ] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);

      const count = await service.detectForBusiness(bizId);

      expect(count).toBe(1);
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: bizId,
          type: 'OVERDUE_REPLY',
          conversationId: 'conv-1',
          customerId: 'c2',
        }),
      );
    });

    it('creates open slot card when waitlist has entries and tomorrow has gaps', async () => {
      prisma.booking.findMany
        .mockResolvedValueOnce([] as any) // deposit pending
        .mockResolvedValueOnce([{ id: 'b1' }, { id: 'b2' }] as any); // only 2 tomorrow bookings
      prisma.conversation.findMany.mockResolvedValue([] as any);
      prisma.waitlistEntry.count.mockResolvedValue(3 as any);

      const count = await service.detectForBusiness(bizId);

      expect(count).toBe(1);
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: bizId,
          type: 'OPEN_SLOT',
          category: 'OPPORTUNITY',
        }),
      );
    });

    it('skips open slot if no waitlist entries', async () => {
      prisma.booking.findMany.mockResolvedValue([] as any);
      prisma.conversation.findMany.mockResolvedValue([] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);

      const count = await service.detectForBusiness(bizId);

      expect(count).toBe(0);
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('skips deposit card if one already exists for same booking', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      prisma.booking.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            startTime: tomorrow,
            customer: { id: 'c1', name: 'Emma' },
            service: { name: 'Botox' },
            staffId: null,
          },
        ] as any)
        .mockResolvedValueOnce([] as any);
      prisma.conversation.findMany.mockResolvedValue([] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);
      prisma.actionCard.findMany.mockResolvedValue([
        { type: 'DEPOSIT_PENDING', bookingId: 'b1', conversationId: null },
      ] as any);

      const count = await service.detectForBusiness(bizId);

      expect(count).toBe(0);
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('skips overdue reply card if one already exists for same conversation', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      prisma.booking.findMany.mockResolvedValue([] as any);
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          lastMessageAt: twoHoursAgo,
          customer: { id: 'c2', name: 'James' },
          assignedTo: null,
          assignedToId: null,
        },
      ] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);
      prisma.actionCard.findMany.mockResolvedValue([
        { type: 'OVERDUE_REPLY', bookingId: null, conversationId: 'conv-1' },
      ] as any);

      const count = await service.detectForBusiness(bizId);

      expect(count).toBe(0);
    });

    it('sets higher priority for bookings within 1 day', async () => {
      const soonBooking = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

      prisma.booking.findMany
        .mockResolvedValueOnce([
          {
            id: 'b2',
            startTime: soonBooking,
            customer: { id: 'c1', name: 'Emma' },
            service: { name: 'Filler' },
            staffId: null,
          },
        ] as any)
        .mockResolvedValueOnce([] as any);
      prisma.conversation.findMany.mockResolvedValue([] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);

      await service.detectForBusiness(bizId);

      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 95,
          category: 'URGENT_TODAY',
        }),
      );
    });

    it('handles errors gracefully when creating individual cards', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      prisma.booking.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            startTime: tomorrow,
            customer: { id: 'c1', name: 'Emma' },
            service: { name: 'Botox' },
            staffId: null,
          },
        ] as any)
        .mockResolvedValueOnce([] as any);
      prisma.conversation.findMany.mockResolvedValue([] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);
      actionCardService.create.mockRejectedValue(new Error('DB error'));

      // Should not throw
      const count = await service.detectForBusiness(bizId);
      expect(count).toBe(0);
    });

    it('creates multiple card types in a single run', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      prisma.booking.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            startTime: tomorrow,
            customer: { id: 'c1', name: 'Emma' },
            service: { name: 'Botox' },
            staffId: null,
          },
        ] as any)
        .mockResolvedValueOnce([{ id: 'b2' }] as any); // 1 booking tomorrow
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          lastMessageAt: twoHoursAgo,
          customer: { id: 'c2', name: 'James' },
          assignedTo: null,
          assignedToId: null,
        },
      ] as any);
      prisma.waitlistEntry.count.mockResolvedValue(2 as any);

      const count = await service.detectForBusiness(bizId);

      // deposit + overdue + open slot = 3
      expect(count).toBe(3);
      expect(actionCardService.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('detectOpportunities', () => {
    it('iterates over all businesses', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'biz-1', packConfig: {} },
        { id: 'biz-2', packConfig: {} },
      ] as any);
      // Each business: no data
      prisma.booking.findMany.mockResolvedValue([] as any);
      prisma.conversation.findMany.mockResolvedValue([] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);
      prisma.actionCard.findMany.mockResolvedValue([] as any);

      await service.detectOpportunities();

      // findMany called for businesses + 2x per business for bookings + etc.
      expect(prisma.business.findMany).toHaveBeenCalledTimes(1);
    });

    it('handles empty business list', async () => {
      prisma.business.findMany.mockResolvedValue([] as any);

      await service.detectOpportunities();

      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('continues to next business on error', async () => {
      prisma.business.findMany.mockResolvedValue([
        { id: 'biz-1', packConfig: {} },
        { id: 'biz-2', packConfig: {} },
      ] as any);

      let callCount = 0;
      prisma.booking.findMany.mockImplementation((() => {
        callCount++;
        if (callCount <= 2) throw new Error('DB error'); // First business fails
        return Promise.resolve([]);
      }) as any);
      prisma.conversation.findMany.mockResolvedValue([] as any);
      prisma.waitlistEntry.count.mockResolvedValue(0 as any);
      prisma.actionCard.findMany.mockResolvedValue([] as any);

      // Should not throw
      await service.detectOpportunities();
    });
  });
});
