import { Test } from '@nestjs/testing';
import { CustomerMergeService } from './customer-merge.service';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';
import { createMockPrisma } from '../../test/mocks';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('CustomerMergeService', () => {
  let service: CustomerMergeService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let actionHistoryService: { create: jest.Mock };

  const mockPrimary = {
    id: 'c1',
    businessId: 'biz1',
    name: 'Jane Doe',
    phone: '5551234567',
    email: 'jane@test.com',
    tags: ['vip'],
    customFields: { preferredTime: 'morning' },
  };

  const mockSecondary = {
    id: 'c2',
    businessId: 'biz1',
    name: 'Jane D.',
    phone: '5551234567',
    email: null,
    tags: ['loyal'],
    customFields: { referral: 'google' },
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    actionHistoryService = { create: jest.fn().mockResolvedValue({}) };

    // Setup transaction mock
    prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

    const module = await Test.createTestingModule({
      providers: [
        CustomerMergeService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActionHistoryService, useValue: actionHistoryService },
      ],
    }).compile();

    service = module.get(CustomerMergeService);
  });

  describe('mergeCustomers', () => {
    it('throws BadRequestException when merging customer with themselves', async () => {
      await expect(service.mergeCustomers('biz1', 'c1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when primary not found', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSecondary as any);

      await expect(service.mergeCustomers('biz1', 'c1', 'c2')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when secondary not found', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any)
        .mockResolvedValueOnce(null);

      await expect(service.mergeCustomers('biz1', 'c1', 'c2')).rejects.toThrow(NotFoundException);
    });

    it('transfers bookings from secondary to primary', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any)
        .mockResolvedValueOnce(mockSecondary as any);
      prisma.customer.findUnique.mockResolvedValue(mockPrimary as any);

      await service.mergeCustomers('biz1', 'c1', 'c2');

      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'c2', businessId: 'biz1' },
        data: { customerId: 'c1' },
      });
    });

    it('transfers conversations from secondary to primary', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any)
        .mockResolvedValueOnce(mockSecondary as any);
      prisma.customer.findUnique.mockResolvedValue(mockPrimary as any);

      await service.mergeCustomers('biz1', 'c1', 'c2');

      expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'c2', businessId: 'biz1' },
        data: { customerId: 'c1' },
      });
    });

    it('merges tags as union', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any)
        .mockResolvedValueOnce(mockSecondary as any);
      prisma.customer.findUnique.mockResolvedValue(mockPrimary as any);

      await service.mergeCustomers('biz1', 'c1', 'c2');

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({
            tags: expect.arrayContaining(['vip', 'loyal']),
          }),
        }),
      );
    });

    it('merges custom fields with primary winning conflicts', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any)
        .mockResolvedValueOnce(mockSecondary as any);
      prisma.customer.findUnique.mockResolvedValue(mockPrimary as any);

      await service.mergeCustomers('biz1', 'c1', 'c2');

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              preferredTime: 'morning',
              referral: 'google',
            }),
          }),
        }),
      );
    });

    it('deletes secondary customer', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any)
        .mockResolvedValueOnce(mockSecondary as any);
      prisma.customer.findUnique.mockResolvedValue(mockPrimary as any);

      await service.mergeCustomers('biz1', 'c1', 'c2');

      expect(prisma.customer.delete).toHaveBeenCalledWith({ where: { id: 'c2' } });
    });

    it('updates DuplicateCandidate status to MERGED', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any)
        .mockResolvedValueOnce(mockSecondary as any);
      prisma.customer.findUnique.mockResolvedValue(mockPrimary as any);

      await service.mergeCustomers('biz1', 'c1', 'c2', 'staff1');

      expect(prisma.duplicateCandidate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'MERGED',
            resolvedBy: 'staff1',
          }),
        }),
      );
    });

    it('logs merge in action history', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any)
        .mockResolvedValueOnce(mockSecondary as any);
      prisma.customer.findUnique.mockResolvedValue(mockPrimary as any);

      await service.mergeCustomers('biz1', 'c1', 'c2', 'staff1', 'Sarah');

      expect(actionHistoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          action: 'CUSTOMER_MERGED',
          entityType: 'CUSTOMER',
          entityId: 'c1',
        }),
      );
    });
  });

  describe('markNotDuplicate', () => {
    it('updates DuplicateCandidate status to NOT_DUPLICATE', async () => {
      prisma.duplicateCandidate.findFirst.mockResolvedValue({
        id: 'dc1',
        status: 'PENDING',
      } as any);
      prisma.duplicateCandidate.update.mockResolvedValue({
        id: 'dc1',
        status: 'NOT_DUPLICATE',
      } as any);

      const result = await service.markNotDuplicate('biz1', 'c1', 'c2', 'staff1');

      expect(result.status).toBe('NOT_DUPLICATE');
      expect(prisma.duplicateCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'NOT_DUPLICATE',
            resolvedBy: 'staff1',
          }),
        }),
      );
    });

    it('throws NotFoundException when candidate not found', async () => {
      prisma.duplicateCandidate.findFirst.mockResolvedValue(null);

      await expect(service.markNotDuplicate('biz1', 'c1', 'c2')).rejects.toThrow(NotFoundException);
    });
  });
});
