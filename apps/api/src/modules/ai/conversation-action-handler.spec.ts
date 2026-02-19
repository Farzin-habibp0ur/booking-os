import { Test } from '@nestjs/testing';
import { ConversationActionHandler, ConversationActionContext } from './conversation-action-handler';
import { ActionCardService } from '../action-card/action-card.service';

describe('ConversationActionHandler', () => {
  let handler: ConversationActionHandler;
  let actionCardService: { create: jest.Mock };

  const mockCtx: ConversationActionContext = {
    businessId: 'biz1',
    conversationId: 'conv1',
    customerId: 'cust1',
    customerName: 'Emma',
    intent: 'BOOK_APPOINTMENT',
    confidence: 0.95,
  };

  beforeEach(async () => {
    actionCardService = {
      create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ConversationActionHandler,
        { provide: ActionCardService, useValue: actionCardService },
      ],
    }).compile();

    handler = module.get(ConversationActionHandler);
  });

  describe('handleBookingState', () => {
    it('creates action card when booking reaches CONFIRM state', async () => {
      const result = await handler.handleBookingState(mockCtx, {
        state: 'CONFIRM',
        serviceId: 'svc1',
        serviceName: 'Botox',
        date: '2026-02-25',
        time: '10:00',
        slotIso: '2026-02-25T10:00:00Z',
        staffId: 'staff1',
        staffName: 'Dr. Chen',
      });

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BOOKING_CONFIRM',
          category: 'NEEDS_APPROVAL',
          priority: 80,
          title: 'Confirm booking for Emma',
          conversationId: 'conv1',
          customerId: 'cust1',
        }),
      );
    });

    it('returns null for non-CONFIRM state', async () => {
      const result = await handler.handleBookingState(mockCtx, {
        state: 'SELECT_SERVICE',
        serviceId: 'svc1',
      });

      expect(result).toBeNull();
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('returns null when serviceId missing', async () => {
      const result = await handler.handleBookingState(mockCtx, {
        state: 'CONFIRM',
        slotIso: '2026-02-25T10:00:00Z',
      });

      expect(result).toBeNull();
    });

    it('returns null when slotIso missing', async () => {
      const result = await handler.handleBookingState(mockCtx, {
        state: 'CONFIRM',
        serviceId: 'svc1',
      });

      expect(result).toBeNull();
    });

    it('handles error gracefully', async () => {
      actionCardService.create.mockRejectedValue(new Error('DB error'));

      const result = await handler.handleBookingState(mockCtx, {
        state: 'CONFIRM',
        serviceId: 'svc1',
        slotIso: '2026-02-25T10:00:00Z',
      });

      expect(result).toBeNull();
    });

    it('includes staff info in description when provided', async () => {
      await handler.handleBookingState(mockCtx, {
        state: 'CONFIRM',
        serviceId: 'svc1',
        serviceName: 'Filler',
        date: '2026-03-01',
        time: '14:00',
        slotIso: '2026-03-01T14:00:00Z',
        staffName: 'Dr. Kim',
      });

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.description).toContain('with Dr. Kim');
    });
  });

  describe('handleCancelState', () => {
    it('creates action card when cancel reaches CONFIRM_CANCEL', async () => {
      const result = await handler.handleCancelState(
        { ...mockCtx, intent: 'CANCEL' },
        {
          state: 'CONFIRM_CANCEL',
          bookingId: 'book1',
          serviceName: 'Botox',
        },
      );

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BOOKING_CANCEL',
          category: 'NEEDS_APPROVAL',
          bookingId: 'book1',
        }),
      );
    });

    it('returns null for non-CONFIRM_CANCEL state', async () => {
      const result = await handler.handleCancelState(mockCtx, {
        state: 'IDENTIFY_BOOKING',
      });

      expect(result).toBeNull();
    });

    it('returns null when bookingId missing', async () => {
      const result = await handler.handleCancelState(mockCtx, {
        state: 'CONFIRM_CANCEL',
      });

      expect(result).toBeNull();
    });

    it('handles error gracefully', async () => {
      actionCardService.create.mockRejectedValue(new Error('DB error'));

      const result = await handler.handleCancelState(mockCtx, {
        state: 'CONFIRM_CANCEL',
        bookingId: 'book1',
      });

      expect(result).toBeNull();
    });
  });

  describe('handleRescheduleState', () => {
    it('creates action card when reschedule reaches CONFIRM_RESCHEDULE', async () => {
      const result = await handler.handleRescheduleState(
        { ...mockCtx, intent: 'RESCHEDULE' },
        {
          state: 'CONFIRM_RESCHEDULE',
          bookingId: 'book1',
          newDate: '2026-03-05',
          newTime: '15:00',
          newSlotIso: '2026-03-05T15:00:00Z',
        },
      );

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BOOKING_RESCHEDULE',
          category: 'NEEDS_APPROVAL',
          bookingId: 'book1',
        }),
      );
    });

    it('returns null for non-CONFIRM_RESCHEDULE state', async () => {
      const result = await handler.handleRescheduleState(mockCtx, {
        state: 'SELECT_NEW_TIME',
      });

      expect(result).toBeNull();
    });

    it('returns null when bookingId missing', async () => {
      const result = await handler.handleRescheduleState(mockCtx, {
        state: 'CONFIRM_RESCHEDULE',
        newSlotIso: '2026-03-05T15:00:00Z',
      });

      expect(result).toBeNull();
    });

    it('returns null when newSlotIso missing', async () => {
      const result = await handler.handleRescheduleState(mockCtx, {
        state: 'CONFIRM_RESCHEDULE',
        bookingId: 'book1',
      });

      expect(result).toBeNull();
    });
  });

  describe('handleLowConfidence', () => {
    it('creates card when confidence below 0.6', async () => {
      const result = await handler.handleLowConfidence({
        ...mockCtx,
        confidence: 0.4,
      });

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LOW_CONFIDENCE',
          category: 'NEEDS_APPROVAL',
          priority: 60,
        }),
      );
    });

    it('returns null when confidence >= 0.6', async () => {
      const result = await handler.handleLowConfidence(mockCtx);

      expect(result).toBeNull();
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('includes confidence percentage in description', async () => {
      await handler.handleLowConfidence({
        ...mockCtx,
        confidence: 0.35,
      });

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.description).toContain('35%');
    });

    it('sets 4-hour expiry', async () => {
      const before = Date.now();
      await handler.handleLowConfidence({ ...mockCtx, confidence: 0.3 });

      const createArg = actionCardService.create.mock.calls[0][0];
      const expiresAt = createArg.expiresAt.getTime();
      const fourHoursMs = 4 * 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThanOrEqual(before + fourHoursMs - 1000);
      expect(expiresAt).toBeLessThanOrEqual(before + fourHoursMs + 1000);
    });
  });

  describe('handleTransferToHuman', () => {
    it('creates urgent action card', async () => {
      const result = await handler.handleTransferToHuman({
        ...mockCtx,
        intent: 'TRANSFER_TO_HUMAN',
      });

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HUMAN_TAKEOVER',
          category: 'URGENT_TODAY',
          priority: 90,
        }),
      );
    });

    it('handles error gracefully', async () => {
      actionCardService.create.mockRejectedValue(new Error('Failed'));

      const result = await handler.handleTransferToHuman(mockCtx);

      expect(result).toBeNull();
    });

    it('includes customer name in title', async () => {
      await handler.handleTransferToHuman(mockCtx);

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.title).toContain('Emma');
    });

    it('uses fallback when no customer name', async () => {
      await handler.handleTransferToHuman({
        ...mockCtx,
        customerName: undefined,
      });

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.title).toContain('customer');
    });
  });
});
