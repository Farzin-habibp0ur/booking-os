import { Test } from '@nestjs/testing';
import { DepositCardHandler } from './deposit-card-handler';
import { ActionCardService } from '../action-card/action-card.service';
import { PolicyComplianceService } from './policy-compliance.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('DepositCardHandler', () => {
  let handler: DepositCardHandler;
  let prisma: ReturnType<typeof createMockPrisma>;
  let actionCardService: { create: jest.Mock };
  let policyCompliance: { checkDepositPolicy: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    actionCardService = {
      create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }),
    };
    policyCompliance = {
      checkDepositPolicy: jest
        .fn()
        .mockResolvedValue({ allowed: true, reason: 'Deposit of $50.00 required' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DepositCardHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: ActionCardService, useValue: actionCardService },
        { provide: PolicyComplianceService, useValue: policyCompliance },
      ],
    }).compile();

    handler = module.get(DepositCardHandler);
  });

  describe('createDepositCard', () => {
    it('creates deposit card when policy allows', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null); // no existing card
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust1', name: 'Emma' } as any);
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        name: 'Botox',
        depositAmount: 50,
      } as any);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        startTime: new Date('2026-03-01T10:00:00Z'),
      } as any);

      const result = await handler.createDepositCard('biz1', 'book1', 'cust1', 'svc1');

      expect(result).toEqual({ id: 'card1', status: 'PENDING' });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DEPOSIT_PENDING',
          category: 'URGENT_TODAY',
          priority: 85,
          title: 'Collect deposit from Emma',
          bookingId: 'book1',
          customerId: 'cust1',
        }),
      );
    });

    it('returns null when policy disallows', async () => {
      policyCompliance.checkDepositPolicy.mockResolvedValue({
        allowed: false,
        reason: 'Service does not require deposit',
      });

      const result = await handler.createDepositCard('biz1', 'book1', 'cust1', 'svc1');

      expect(result).toBeNull();
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('returns existing card if already exists', async () => {
      const existingCard = { id: 'existing1', status: 'PENDING', type: 'DEPOSIT_PENDING' };
      prisma.actionCard.findFirst.mockResolvedValue(existingCard as any);

      const result = await handler.createDepositCard('biz1', 'book1', 'cust1', 'svc1');

      expect(result).toEqual(existingCard);
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('includes deposit amount in description', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust1', name: 'Emma' } as any);
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        name: 'Filler',
        depositAmount: 75.5,
      } as any);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        startTime: new Date('2026-03-01T10:00:00Z'),
      } as any);

      await handler.createDepositCard('biz1', 'book1', 'cust1', 'svc1');

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.description).toContain('$75.50');
    });

    it('sets expiry to booking start time', async () => {
      const bookingTime = new Date('2026-03-01T10:00:00Z');
      prisma.actionCard.findFirst.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust1', name: 'Test' } as any);
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        name: 'Test',
        depositAmount: 50,
      } as any);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        startTime: bookingTime,
      } as any);

      await handler.createDepositCard('biz1', 'book1', 'cust1', 'svc1');

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.expiresAt).toEqual(bookingTime);
    });

    it('handles error gracefully', async () => {
      prisma.actionCard.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await handler.createDepositCard('biz1', 'book1', 'cust1', 'svc1');

      expect(result).toBeNull();
    });

    it('includes conversationId when provided', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust1', name: 'Test' } as any);
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        name: 'Test',
        depositAmount: 50,
      } as any);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        startTime: new Date(),
      } as any);

      await handler.createDepositCard('biz1', 'book1', 'cust1', 'svc1', 'conv1');

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.conversationId).toBe('conv1');
    });
  });

  describe('checkAndCreateForBooking', () => {
    it('creates card for booking with required deposit', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        businessId: 'biz1',
        customerId: 'cust1',
        serviceId: 'svc1',
        conversationId: 'conv1',
        status: 'CONFIRMED',
        service: { depositRequired: true, depositAmount: 50 },
        customer: { name: 'Emma' },
      } as any);
      prisma.payment.findFirst.mockResolvedValue(null); // no payment

      // For createDepositCard internals
      prisma.actionCard.findFirst.mockResolvedValue(null);
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust1', name: 'Emma' } as any);
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        name: 'Botox',
        depositAmount: 50,
      } as any);

      await handler.checkAndCreateForBooking('biz1', 'book1');

      expect(actionCardService.create).toHaveBeenCalled();
    });

    it('skips when deposit not required', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        businessId: 'biz1',
        customerId: 'cust1',
        serviceId: 'svc1',
        status: 'CONFIRMED',
        service: { depositRequired: false },
      } as any);

      const result = await handler.checkAndCreateForBooking('biz1', 'book1');

      expect(result).toBeNull();
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('skips when booking cancelled', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        businessId: 'biz1',
        status: 'CANCELLED',
        service: { depositRequired: true },
      } as any);

      const result = await handler.checkAndCreateForBooking('biz1', 'book1');

      expect(result).toBeNull();
    });

    it('skips when deposit already paid', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        businessId: 'biz1',
        customerId: 'cust1',
        serviceId: 'svc1',
        status: 'CONFIRMED',
        service: { depositRequired: true },
      } as any);
      prisma.payment.findFirst.mockResolvedValue({ id: 'pay1', status: 'succeeded' } as any);

      const result = await handler.checkAndCreateForBooking('biz1', 'book1');

      expect(result).toBeNull();
    });

    it('skips when booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      const result = await handler.checkAndCreateForBooking('biz1', 'book1');

      expect(result).toBeNull();
    });

    it('handles errors gracefully', async () => {
      prisma.booking.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await handler.checkAndCreateForBooking('biz1', 'book1');

      expect(result).toBeNull();
    });
  });
});
