import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../../common/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('RefundsService', () => {
  let service: RefundsService;
  let prisma: MockPrisma;
  let configService: { get: jest.Mock };

  const mockPayment = {
    id: 'pay1',
    businessId: 'biz1',
    amount: 100,
    method: 'CASH',
    stripePaymentIntentId: null,
    bookingId: 'b1',
    refunds: [],
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    configService = { get: jest.fn().mockReturnValue(null) };

    const module = await Test.createTestingModule({
      providers: [
        RefundsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(RefundsService);
  });

  describe('create', () => {
    it('creates a refund for non-Stripe payment', async () => {
      prisma.payment.findFirst.mockResolvedValue(mockPayment as any);
      prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'COMPLETED' } as any);
      prisma.payment.update.mockResolvedValue({} as any);
      prisma.actionHistory.create.mockResolvedValue({} as any);

      const result = await service.create(
        'biz1',
        { paymentId: 'pay1', amount: 50, reason: 'test' } as any,
        'staff1',
      );

      expect(result).toEqual({ id: 'r1', status: 'COMPLETED' });
      expect(prisma.refund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          paymentId: 'pay1',
          amount: 50,
          reason: 'test',
          status: 'COMPLETED',
          processedById: 'staff1',
        }),
        include: { payment: true },
      });
      expect(prisma.payment.update).toHaveBeenCalled();
    });

    it('creates partial refund and sets PARTIAL_REFUND status', async () => {
      prisma.payment.findFirst.mockResolvedValue(mockPayment as any);
      prisma.refund.create.mockResolvedValue({ id: 'r1' } as any);
      prisma.payment.update.mockResolvedValue({} as any);
      prisma.actionHistory.create.mockResolvedValue({} as any);

      await service.create(
        'biz1',
        { paymentId: 'pay1', amount: 50, reason: 'partial' } as any,
        'staff1',
      );

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay1' },
        data: { status: 'PARTIAL_REFUND' },
      });
    });

    it('creates full refund and sets REFUNDED status', async () => {
      prisma.payment.findFirst.mockResolvedValue(mockPayment as any);
      prisma.refund.create.mockResolvedValue({ id: 'r1' } as any);
      prisma.payment.update.mockResolvedValue({} as any);
      prisma.actionHistory.create.mockResolvedValue({} as any);

      await service.create(
        'biz1',
        { paymentId: 'pay1', amount: 100, reason: 'full' } as any,
        'staff1',
      );

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay1' },
        data: { status: 'REFUNDED' },
      });
    });

    it('throws BadRequestException when amount exceeds refundable', async () => {
      const paymentWithRefunds = {
        ...mockPayment,
        refunds: [{ status: 'COMPLETED', amount: 80 }],
      };
      prisma.payment.findFirst.mockResolvedValue(paymentWithRefunds as any);

      await expect(
        service.create(
          'biz1',
          { paymentId: 'pay1', amount: 30, reason: 'too much' } as any,
          'staff1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when payment not found', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(
        service.create('biz1', { paymentId: 'pay1', amount: 50, reason: 'test' } as any, 'staff1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('filters by businessId for tenant isolation', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      try {
        await service.create(
          'biz1',
          { paymentId: 'pay1', amount: 50, reason: 'test' } as any,
          'staff1',
        );
      } catch {}

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { id: 'pay1', businessId: 'biz1' },
        include: { refunds: true },
      });
    });

    it('creates action history entry', async () => {
      prisma.payment.findFirst.mockResolvedValue(mockPayment as any);
      prisma.refund.create.mockResolvedValue({ id: 'r1' } as any);
      prisma.payment.update.mockResolvedValue({} as any);
      prisma.actionHistory.create.mockResolvedValue({} as any);

      await service.create(
        'biz1',
        { paymentId: 'pay1', amount: 50, reason: 'test' } as any,
        'staff1',
      );

      expect(prisma.actionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          actorType: 'STAFF',
          actorId: 'staff1',
          action: 'REFUND_PROCESSED',
          entityType: 'BOOKING',
          entityId: 'b1',
        }),
      });
    });

    it('handles Stripe refund when stripePaymentIntentId exists', async () => {
      // Rebuild service with Stripe key configured
      configService.get.mockReturnValue('sk_test_123');
      const module = await Test.createTestingModule({
        providers: [
          RefundsService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const stripeService = module.get(RefundsService);

      const stripePayment = { ...mockPayment, stripePaymentIntentId: 'pi_123' };
      prisma.payment.findFirst.mockResolvedValue(stripePayment as any);
      prisma.refund.create.mockResolvedValue({ id: 'r1' } as any);
      prisma.payment.update.mockResolvedValue({} as any);
      prisma.actionHistory.create.mockResolvedValue({} as any);

      // Mock the Stripe instance on the service
      const mockStripe = {
        refunds: { create: jest.fn().mockResolvedValue({ id: 're_123' }) },
      };
      (stripeService as any).stripe = mockStripe;

      await stripeService.create(
        'biz1',
        { paymentId: 'pay1', amount: 50, reason: 'stripe test' } as any,
        'staff1',
      );

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_123',
        amount: 5000,
        reason: 'requested_by_customer',
      });
      expect(prisma.refund.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripeRefundId: 're_123',
            status: 'COMPLETED',
          }),
        }),
      );
    });

    it('creates FAILED refund when Stripe API errors', async () => {
      const stripePayment = { ...mockPayment, stripePaymentIntentId: 'pi_123' };
      prisma.payment.findFirst.mockResolvedValue(stripePayment as any);
      prisma.refund.create.mockResolvedValue({ id: 'r1', status: 'FAILED' } as any);

      // Mock Stripe that throws
      const mockStripe = {
        refunds: { create: jest.fn().mockRejectedValue(new Error('Stripe error')) },
      };
      (service as any).stripe = mockStripe;

      const result = await service.create(
        'biz1',
        { paymentId: 'pay1', amount: 50, reason: 'fail test' } as any,
        'staff1',
      );

      expect(result).toEqual({ id: 'r1', status: 'FAILED' });
      expect(prisma.refund.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          paymentId: 'pay1',
          amount: 50,
        }),
        include: { payment: true },
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated refunds', async () => {
      const refunds = [{ id: 'r1' }, { id: 'r2' }];
      prisma.refund.findMany.mockResolvedValue(refunds as any);
      prisma.refund.count.mockResolvedValue(2);

      const result = await service.findAll('biz1', {} as any);

      expect(result).toEqual({ data: refunds, total: 2 });
      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { payment: true },
        }),
      );
    });

    it('filters by paymentId', async () => {
      prisma.refund.findMany.mockResolvedValue([]);
      prisma.refund.count.mockResolvedValue(0);

      await service.findAll('biz1', { paymentId: 'pay1' } as any);

      expect(prisma.refund.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', paymentId: 'pay1' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns refund', async () => {
      const refund = { id: 'r1', businessId: 'biz1' };
      prisma.refund.findFirst.mockResolvedValue(refund as any);

      const result = await service.findOne('biz1', 'r1');

      expect(result).toEqual(refund);
      expect(prisma.refund.findFirst).toHaveBeenCalledWith({
        where: { id: 'r1', businessId: 'biz1' },
        include: { payment: true },
      });
    });

    it('throws NotFoundException when refund not found', async () => {
      prisma.refund.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'r1')).rejects.toThrow(NotFoundException);
    });
  });
});
