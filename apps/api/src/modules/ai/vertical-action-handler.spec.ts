import { Test } from '@nestjs/testing';
import { VerticalActionHandler, VerticalActionContext } from './vertical-action-handler';
import { ActionCardService } from '../action-card/action-card.service';
import { PrismaService } from '../../common/prisma.service';

describe('VerticalActionHandler', () => {
  let handler: VerticalActionHandler;
  let actionCardService: { create: jest.Mock };
  let prisma: any;

  beforeEach(async () => {
    actionCardService = {
      create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }),
    };
    prisma = {
      deal: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      testDrive: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module = await Test.createTestingModule({
      providers: [
        VerticalActionHandler,
        { provide: ActionCardService, useValue: actionCardService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(VerticalActionHandler);
  });

  describe('handleVerticalAction', () => {
    describe('aesthetics vertical', () => {
      const aestheticsCtx: VerticalActionContext = {
        businessId: 'biz1',
        conversationId: 'conv1',
        customerId: 'cust1',
        customerName: 'Emma',
        verticalPack: 'aesthetics',
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.9,
      };

      it('creates consult-to-treatment card for booking intent', async () => {
        const result = await handler.handleVerticalAction(aestheticsCtx);

        expect(result).toEqual({ id: 'card1', status: 'PENDING' });
        expect(actionCardService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'CONSULT_TO_TREATMENT',
            category: 'OPPORTUNITY',
            priority: 65,
            title: 'Treatment opportunity for Emma',
          }),
        );
      });

      it('creates treatment inquiry card', async () => {
        await handler.handleVerticalAction({
          ...aestheticsCtx,
          intent: 'INQUIRY',
        });

        expect(actionCardService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'TREATMENT_INQUIRY',
            priority: 55,
          }),
        );
      });
    });

    describe('dealership vertical', () => {
      const dealershipCtx: VerticalActionContext = {
        businessId: 'biz1',
        conversationId: 'conv1',
        customerId: 'cust1',
        customerName: 'Mike',
        verticalPack: 'dealership',
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.85,
      };

      it('creates service appointment card', async () => {
        const result = await handler.handleVerticalAction(dealershipCtx);

        expect(result).toEqual({ id: 'card1', status: 'PENDING' });
        expect(actionCardService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SERVICE_APPOINTMENT',
            category: 'NEEDS_APPROVAL',
          }),
        );
      });

      it('creates sales lead card', async () => {
        await handler.handleVerticalAction({
          ...dealershipCtx,
          intent: 'SALES_INQUIRY',
        });

        expect(actionCardService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'SALES_LEAD',
            category: 'OPPORTUNITY',
            priority: 80,
          }),
        );
      });

      it('creates trade-in lead card', async () => {
        await handler.handleVerticalAction({
          ...dealershipCtx,
          intent: 'TRADE_IN_INQUIRY',
        });

        expect(actionCardService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'TRADE_IN_LEAD',
            priority: 75,
          }),
        );
      });
    });

    it('returns null for unknown vertical pack', async () => {
      const result = await handler.handleVerticalAction({
        businessId: 'biz1',
        conversationId: 'conv1',
        verticalPack: 'unknown',
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.9,
      });

      expect(result).toBeNull();
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('returns null for unsupported intent in vertical', async () => {
      const result = await handler.handleVerticalAction({
        businessId: 'biz1',
        conversationId: 'conv1',
        verticalPack: 'aesthetics',
        intent: 'TRADE_IN_INQUIRY',
        confidence: 0.9,
      });

      expect(result).toBeNull();
    });

    it('uses fallback name when customerName not provided', async () => {
      await handler.handleVerticalAction({
        businessId: 'biz1',
        conversationId: 'conv1',
        verticalPack: 'aesthetics',
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.9,
      });

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.title).toContain('customer');
    });

    it('includes vertical metadata in card', async () => {
      await handler.handleVerticalAction({
        businessId: 'biz1',
        conversationId: 'conv1',
        verticalPack: 'dealership',
        intent: 'SALES_INQUIRY',
        confidence: 0.8,
      });

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.metadata.verticalPack).toBe('dealership');
      expect(createArg.metadata.intent).toBe('SALES_INQUIRY');
    });

    it('handles error gracefully', async () => {
      actionCardService.create.mockRejectedValue(new Error('DB error'));

      const result = await handler.handleVerticalAction({
        businessId: 'biz1',
        conversationId: 'conv1',
        verticalPack: 'aesthetics',
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.9,
      });

      expect(result).toBeNull();
    });
  });

  describe('handleDealershipSalesInquiry', () => {
    const salesCtx: VerticalActionContext = {
      businessId: 'biz1',
      conversationId: 'conv1',
      customerId: 'cust1',
      customerName: 'Mike',
      verticalPack: 'dealership',
      intent: 'SALES_INQUIRY',
      confidence: 0.9,
    };

    it('creates DEAL_UPDATE card when customer has open deal', async () => {
      prisma.deal.findFirst.mockResolvedValue({
        id: 'deal-1',
        stage: 'NEGOTIATION',
        vehicle: { year: 2025, make: 'Toyota', model: 'Camry' },
      });

      await handler.handleVerticalAction(salesCtx);

      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEAL_UPDATE',
          category: 'OPPORTUNITY',
          priority: 85,
          customerId: 'cust1',
          metadata: expect.objectContaining({ dealId: 'deal-1' }),
        }),
      );
    });

    it('creates TEST_DRIVE_FOLLOWUP when test drives exist but no deal', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);
      prisma.testDrive.findMany.mockResolvedValue([
        {
          id: 'td-1',
          vehicleId: 'v-1',
          vehicle: { year: 2025, make: 'Honda', model: 'Civic' },
        },
      ]);
      prisma.deal.count.mockResolvedValue(0);

      await handler.handleVerticalAction(salesCtx);

      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST_DRIVE_FOLLOWUP',
          category: 'OPPORTUNITY',
          priority: 82,
          metadata: expect.objectContaining({ testDriveId: 'td-1' }),
        }),
      );
    });

    it('falls back to SALES_LEAD when no deal or test drives', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);
      prisma.testDrive.findMany.mockResolvedValue([]);

      await handler.handleVerticalAction(salesCtx);

      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SALES_LEAD',
          priority: 80,
        }),
      );
    });
  });

  describe('checkStalledDeals', () => {
    it('creates action cards for deals stalled 7+ days', async () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      prisma.deal.findMany.mockResolvedValue([
        {
          id: 'deal-stale',
          stage: 'QUALIFIED',
          updatedAt: eightDaysAgo,
          customer: { id: 'cust1', name: 'Jane Doe' },
          vehicle: { year: 2024, make: 'Ford', model: 'F-150' },
          assignedTo: { name: 'Bob Sales' },
        },
      ]);

      const result = await handler.checkStalledDeals('biz1');

      expect(result).toHaveLength(1);
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          type: 'DEAL_STALLED',
          category: 'NEEDS_APPROVAL',
          priority: 75,
          customerId: 'cust1',
          metadata: expect.objectContaining({
            dealId: 'deal-stale',
            stage: 'QUALIFIED',
          }),
        }),
      );
    });

    it('ignores closed deals', async () => {
      prisma.deal.findMany.mockResolvedValue([]);

      const result = await handler.checkStalledDeals('biz1');

      expect(result).toHaveLength(0);
      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] },
          }),
        }),
      );
    });
  });

  describe('getAvailableActions', () => {
    it('returns actions for aesthetics', () => {
      const actions = handler.getAvailableActions('aesthetics');
      expect(actions).toContain('BOOK_APPOINTMENT');
      expect(actions).toContain('INQUIRY');
    });

    it('returns actions for dealership', () => {
      const actions = handler.getAvailableActions('dealership');
      expect(actions).toContain('BOOK_APPOINTMENT');
      expect(actions).toContain('SALES_INQUIRY');
      expect(actions).toContain('TRADE_IN_INQUIRY');
    });

    it('returns empty array for unknown pack', () => {
      expect(handler.getAvailableActions('unknown')).toEqual([]);
    });
  });

  describe('hasVerticalAction', () => {
    it('returns true for supported vertical+intent', () => {
      expect(handler.hasVerticalAction('aesthetics', 'BOOK_APPOINTMENT')).toBe(true);
    });

    it('returns false for unsupported intent', () => {
      expect(handler.hasVerticalAction('aesthetics', 'TRADE_IN_INQUIRY')).toBe(false);
    });

    it('returns false for unknown vertical', () => {
      expect(handler.hasVerticalAction('unknown', 'BOOK_APPOINTMENT')).toBe(false);
    });
  });
});
