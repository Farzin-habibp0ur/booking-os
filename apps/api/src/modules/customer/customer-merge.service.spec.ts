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

  describe('listDuplicates', () => {
    it('returns paginated duplicate candidates ordered by confidence desc', async () => {
      const mockCandidates = [
        {
          id: 'dc1',
          confidence: 0.95,
          customer1: { id: 'c1', name: 'Jane' },
          customer2: { id: 'c2', name: 'Jane D.' },
        },
        {
          id: 'dc2',
          confidence: 0.8,
          customer1: { id: 'c3', name: 'Bob' },
          customer2: { id: 'c4', name: 'Robert' },
        },
      ];
      prisma.duplicateCandidate.findMany.mockResolvedValue(mockCandidates as any);
      prisma.duplicateCandidate.count.mockResolvedValue(2);

      const result = await service.listDuplicates('biz1');

      expect(result).toEqual({ data: mockCandidates, total: 2, page: 1, pageSize: 20 });
      expect(prisma.duplicateCandidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          orderBy: { confidence: 'desc' },
          skip: 0,
          take: 20,
          include: expect.objectContaining({
            customer1: expect.any(Object),
            customer2: expect.any(Object),
          }),
        }),
      );
    });

    it('filters by status when provided', async () => {
      prisma.duplicateCandidate.findMany.mockResolvedValue([]);
      prisma.duplicateCandidate.count.mockResolvedValue(0);

      await service.listDuplicates('biz1', { status: 'PENDING' });

      expect(prisma.duplicateCandidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', status: 'PENDING' },
        }),
      );
      expect(prisma.duplicateCandidate.count).toHaveBeenCalledWith({
        where: { businessId: 'biz1', status: 'PENDING' },
      });
    });

    it('applies pagination correctly', async () => {
      prisma.duplicateCandidate.findMany.mockResolvedValue([]);
      prisma.duplicateCandidate.count.mockResolvedValue(25);

      const result = await service.listDuplicates('biz1', { page: 2, pageSize: 10 });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(prisma.duplicateCandidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('clamps page to minimum of 1', async () => {
      prisma.duplicateCandidate.findMany.mockResolvedValue([]);
      prisma.duplicateCandidate.count.mockResolvedValue(0);

      const result = await service.listDuplicates('biz1', { page: 0 });

      expect(result.page).toBe(1);
      expect(prisma.duplicateCandidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    });

    it('clamps pageSize to maximum of 100', async () => {
      prisma.duplicateCandidate.findMany.mockResolvedValue([]);
      prisma.duplicateCandidate.count.mockResolvedValue(0);

      const result = await service.listDuplicates('biz1', { pageSize: 500 });

      expect(result.pageSize).toBe(100);
      expect(prisma.duplicateCandidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('snoozeDuplicate', () => {
    it('updates candidate status to SNOOZED', async () => {
      prisma.duplicateCandidate.findFirst.mockResolvedValue({
        id: 'dc1',
        businessId: 'biz1',
        status: 'PENDING',
      } as any);
      prisma.duplicateCandidate.update.mockResolvedValue({
        id: 'dc1',
        status: 'SNOOZED',
      } as any);

      const result = await service.snoozeDuplicate('biz1', 'dc1', 'staff1');

      expect(result.status).toBe('SNOOZED');
      expect(prisma.duplicateCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dc1' },
          data: expect.objectContaining({
            status: 'SNOOZED',
            resolvedBy: 'staff1',
          }),
        }),
      );
    });

    it('throws NotFoundException when candidate not found', async () => {
      prisma.duplicateCandidate.findFirst.mockResolvedValue(null);

      await expect(service.snoozeDuplicate('biz1', 'dc-nonexistent', 'staff1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets resolvedAt timestamp', async () => {
      prisma.duplicateCandidate.findFirst.mockResolvedValue({
        id: 'dc1',
        businessId: 'biz1',
        status: 'PENDING',
      } as any);
      prisma.duplicateCandidate.update.mockResolvedValue({ id: 'dc1', status: 'SNOOZED' } as any);

      await service.snoozeDuplicate('biz1', 'dc1');

      expect(prisma.duplicateCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resolvedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('mergeDuplicateById', () => {
    it('looks up candidate and delegates to mergeCustomers', async () => {
      prisma.duplicateCandidate.findFirst.mockResolvedValue({
        id: 'dc1',
        businessId: 'biz1',
        customerId1: 'c1',
        customerId2: 'c2',
        status: 'PENDING',
      } as any);

      // Mock the mergeCustomers flow
      prisma.customer.findFirst
        .mockResolvedValueOnce(mockPrimary as any) // first call: find candidate by id
        .mockResolvedValueOnce(mockPrimary as any) // mergeCustomers: primary
        .mockResolvedValueOnce(mockSecondary as any); // mergeCustomers: secondary
      prisma.customer.findUnique.mockResolvedValue(mockPrimary as any);

      await service.mergeDuplicateById('biz1', 'dc1', 'staff1', 'Sarah');

      // Verify candidate lookup
      expect(prisma.duplicateCandidate.findFirst).toHaveBeenCalledWith({
        where: { id: 'dc1', businessId: 'biz1' },
      });

      // Verify mergeCustomers was invoked (checks booking transfer as proxy)
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'c2', businessId: 'biz1' },
        data: { customerId: 'c1' },
      });
    });

    it('throws NotFoundException when candidate not found', async () => {
      prisma.duplicateCandidate.findFirst.mockResolvedValue(null);

      await expect(service.mergeDuplicateById('biz1', 'dc-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markNotDuplicateById', () => {
    it('looks up candidate and delegates to markNotDuplicate', async () => {
      // First call: markNotDuplicateById finds the candidate by id
      prisma.duplicateCandidate.findFirst
        .mockResolvedValueOnce({
          id: 'dc1',
          businessId: 'biz1',
          customerId1: 'c1',
          customerId2: 'c2',
          status: 'PENDING',
        } as any)
        // Second call: markNotDuplicate finds by customer pair
        .mockResolvedValueOnce({
          id: 'dc1',
          businessId: 'biz1',
          status: 'PENDING',
        } as any);
      prisma.duplicateCandidate.update.mockResolvedValue({
        id: 'dc1',
        status: 'NOT_DUPLICATE',
      } as any);

      const result = await service.markNotDuplicateById('biz1', 'dc1', 'staff1');

      expect(result.status).toBe('NOT_DUPLICATE');
      // Verify candidate lookup by id
      expect(prisma.duplicateCandidate.findFirst).toHaveBeenCalledWith({
        where: { id: 'dc1', businessId: 'biz1' },
      });
    });

    it('throws NotFoundException when candidate not found', async () => {
      prisma.duplicateCandidate.findFirst.mockResolvedValue(null);

      await expect(service.markNotDuplicateById('biz1', 'dc-missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
