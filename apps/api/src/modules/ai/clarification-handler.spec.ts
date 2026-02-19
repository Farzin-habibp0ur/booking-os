import { Test } from '@nestjs/testing';
import { ClarificationHandler, ClarificationContext } from './clarification-handler';
import { ActionCardService } from '../action-card/action-card.service';

describe('ClarificationHandler', () => {
  let handler: ClarificationHandler;
  let actionCardService: { create: jest.Mock };

  const mockCtx: ClarificationContext = {
    businessId: 'biz1',
    conversationId: 'conv1',
    customerId: 'cust1',
    customerName: 'Emma',
    messageContent: 'I want to maybe change my appointment or something',
    intent: 'GENERAL',
    confidence: 0.3,
  };

  beforeEach(async () => {
    actionCardService = {
      create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ClarificationHandler,
        { provide: ActionCardService, useValue: actionCardService },
      ],
    }).compile();

    handler = module.get(ClarificationHandler);
  });

  describe('handleAmbiguousIntent', () => {
    it('creates urgent card for very low confidence', async () => {
      const result = await handler.handleAmbiguousIntent({
        ...mockCtx,
        confidence: 0.2,
      });

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLARIFICATION_NEEDED',
          category: 'URGENT_TODAY',
          priority: 85,
        }),
      );
    });

    it('creates approval card for low confidence (0.4-0.6)', async () => {
      const result = await handler.handleAmbiguousIntent({
        ...mockCtx,
        confidence: 0.5,
      });

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'NEEDS_APPROVAL',
          priority: 65,
        }),
      );
    });

    it('returns null for medium+ confidence (>= 0.6)', async () => {
      const result = await handler.handleAmbiguousIntent({
        ...mockCtx,
        confidence: 0.7,
      });

      expect(result).toBeNull();
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('includes confidence percentage in description', async () => {
      await handler.handleAmbiguousIntent({
        ...mockCtx,
        confidence: 0.35,
      });

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.description).toContain('35%');
    });

    it('truncates message preview to 200 chars', async () => {
      const longMessage = 'a'.repeat(300);
      await handler.handleAmbiguousIntent({
        ...mockCtx,
        messageContent: longMessage,
        confidence: 0.3,
      });

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.metadata.messagePreview).toHaveLength(200);
    });

    it('handles error gracefully', async () => {
      actionCardService.create.mockRejectedValue(new Error('DB error'));

      const result = await handler.handleAmbiguousIntent(mockCtx);

      expect(result).toBeNull();
    });

    it('sets 2-hour expiry', async () => {
      const before = Date.now();
      await handler.handleAmbiguousIntent(mockCtx);

      const createArg = actionCardService.create.mock.calls[0][0];
      const expiresAt = createArg.expiresAt.getTime();
      const twoHoursMs = 2 * 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThanOrEqual(before + twoHoursMs - 1000);
    });
  });

  describe('handleConflictingIntents', () => {
    it('creates card for multiple intents', async () => {
      const intents = [
        { intent: 'CANCEL', confidence: 0.5 },
        { intent: 'RESCHEDULE', confidence: 0.45 },
      ];

      const result = await handler.handleConflictingIntents(mockCtx, intents);

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLARIFICATION_NEEDED',
          category: 'NEEDS_APPROVAL',
          priority: 70,
        }),
      );
    });

    it('includes intent list in description', async () => {
      const intents = [
        { intent: 'CANCEL', confidence: 0.5 },
        { intent: 'RESCHEDULE', confidence: 0.45 },
      ];

      await handler.handleConflictingIntents(mockCtx, intents);

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.description).toContain('CANCEL (50%)');
      expect(createArg.description).toContain('RESCHEDULE (45%)');
    });

    it('returns null for single intent', async () => {
      const result = await handler.handleConflictingIntents(mockCtx, [
        { intent: 'CANCEL', confidence: 0.5 },
      ]);

      expect(result).toBeNull();
    });

    it('returns null for empty intents', async () => {
      const result = await handler.handleConflictingIntents(mockCtx, []);

      expect(result).toBeNull();
    });

    it('handles error gracefully', async () => {
      actionCardService.create.mockRejectedValue(new Error('DB error'));

      const result = await handler.handleConflictingIntents(mockCtx, [
        { intent: 'A', confidence: 0.5 },
        { intent: 'B', confidence: 0.4 },
      ]);

      expect(result).toBeNull();
    });
  });

  describe('shouldRequestClarification', () => {
    it('returns true for low confidence', () => {
      expect(handler.shouldRequestClarification(0.3)).toBe(true);
    });

    it('returns true for medium-low confidence', () => {
      expect(handler.shouldRequestClarification(0.5)).toBe(true);
    });

    it('returns false for medium+ confidence', () => {
      expect(handler.shouldRequestClarification(0.6)).toBe(false);
    });

    it('returns false for high confidence', () => {
      expect(handler.shouldRequestClarification(0.9)).toBe(false);
    });
  });
});
