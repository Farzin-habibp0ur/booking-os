import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreditService } from './credit.service';
import { PrismaService } from '../../common/prisma.service';

const mockPrisma: any = {
  customerCredit: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  creditRedemption: {
    create: jest.fn(),
  },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

describe('CreditService', () => {
  let service: CreditService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CreditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CreditService>(CreditService);
  });

  describe('issueCredit', () => {
    it('should create a credit record with correct data', async () => {
      mockPrisma.customerCredit.create.mockResolvedValue({
        id: 'credit-1',
        amount: 25,
        remainingAmount: 25,
      });

      const result = await service.issueCredit({
        businessId: 'biz-1',
        customerId: 'cust-1',
        amount: 25,
        source: 'REFERRAL_GIVEN',
        referralId: 'ref-1',
        expiryMonths: 6,
      });

      expect(mockPrisma.customerCredit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz-1',
          customerId: 'cust-1',
          amount: 25,
          remainingAmount: 25,
          source: 'REFERRAL_GIVEN',
          referralId: 'ref-1',
        }),
      });
      expect(result.amount).toBe(25);
    });

    it('should set expiresAt when expiryMonths is provided', async () => {
      mockPrisma.customerCredit.create.mockResolvedValue({ id: 'credit-1' });

      await service.issueCredit({
        businessId: 'biz-1',
        customerId: 'cust-1',
        amount: 25,
        source: 'MANUAL',
        expiryMonths: 3,
      });

      const callData = mockPrisma.customerCredit.create.mock.calls[0][0].data;
      expect(callData.expiresAt).toBeInstanceOf(Date);
      expect(callData.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should set expiresAt to null when no expiryMonths', async () => {
      mockPrisma.customerCredit.create.mockResolvedValue({ id: 'credit-1' });

      await service.issueCredit({
        businessId: 'biz-1',
        customerId: 'cust-1',
        amount: 25,
        source: 'MANUAL',
      });

      const callData = mockPrisma.customerCredit.create.mock.calls[0][0].data;
      expect(callData.expiresAt).toBeNull();
    });
  });

  describe('getAvailableCredits', () => {
    it('should return total and credits ordered by expiresAt', async () => {
      mockPrisma.customerCredit.findMany.mockResolvedValue([
        { id: 'c1', remainingAmount: 10 },
        { id: 'c2', remainingAmount: 15 },
      ]);

      const result = await service.getAvailableCredits('cust-1', 'biz-1');

      expect(result.total).toBe(25);
      expect(result.credits).toHaveLength(2);
      expect(mockPrisma.customerCredit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-1',
            businessId: 'biz-1',
            remainingAmount: { gt: 0 },
          }),
          orderBy: { expiresAt: 'asc' },
        }),
      );
    });

    it('should return zero when no credits available', async () => {
      mockPrisma.customerCredit.findMany.mockResolvedValue([]);

      const result = await service.getAvailableCredits('cust-1', 'biz-1');
      expect(result.total).toBe(0);
      expect(result.credits).toHaveLength(0);
    });
  });

  describe('redeemCredit', () => {
    it('should redeem credits in FIFO order', async () => {
      mockPrisma.customerCredit.findMany.mockResolvedValue([
        { id: 'c1', remainingAmount: 10 },
        { id: 'c2', remainingAmount: 20 },
      ]);
      mockPrisma.customerCredit.update.mockResolvedValue({});
      mockPrisma.creditRedemption.create.mockImplementation(
        ({ data }: { data: { creditId: string; amount: number } }) =>
          Promise.resolve({ id: `red-${data.creditId}`, ...data }),
      );

      const result = await service.redeemCredit({
        customerId: 'cust-1',
        businessId: 'biz-1',
        bookingId: 'book-1',
        amount: 15,
      });

      expect(result).toHaveLength(2);
      // First credit fully consumed
      expect(mockPrisma.customerCredit.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { remainingAmount: 0 },
      });
      // Second credit partially consumed
      expect(mockPrisma.customerCredit.update).toHaveBeenCalledWith({
        where: { id: 'c2' },
        data: { remainingAmount: 15 },
      });
    });

    it('should throw when insufficient credits', async () => {
      mockPrisma.customerCredit.findMany.mockResolvedValue([{ id: 'c1', remainingAmount: 5 }]);

      await expect(
        service.redeemCredit({
          customerId: 'cust-1',
          businessId: 'biz-1',
          bookingId: 'book-1',
          amount: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('expireCredits', () => {
    it('should set remainingAmount to 0 on expired credits', async () => {
      mockPrisma.customerCredit.updateMany.mockResolvedValue({ count: 3 });

      const count = await service.expireCredits();

      expect(count).toBe(3);
      expect(mockPrisma.customerCredit.updateMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
          remainingAmount: { gt: 0 },
        },
        data: { remainingAmount: 0 },
      });
    });
  });
});
