import { Test } from '@nestjs/testing';
import { VerticalActionHandler, VerticalActionContext } from './vertical-action-handler';
import { ActionCardService } from '../action-card/action-card.service';

describe('VerticalActionHandler', () => {
  let handler: VerticalActionHandler;
  let actionCardService: { create: jest.Mock };

  beforeEach(async () => {
    actionCardService = {
      create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        VerticalActionHandler,
        { provide: ActionCardService, useValue: actionCardService },
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
