import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OutboundService } from './outbound.service';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';
import { createMockPrisma, createMockActionHistoryService } from '../../test/mocks';

describe('OutboundService', () => {
  let service: OutboundService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let actionHistoryService: ReturnType<typeof createMockActionHistoryService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    actionHistoryService = createMockActionHistoryService();

    const module = await Test.createTestingModule({
      providers: [
        OutboundService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActionHistoryService, useValue: actionHistoryService },
      ],
    }).compile();

    service = module.get(OutboundService);
  });

  describe('createDraft', () => {
    it('creates a draft with defaults', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust1', name: 'Emma' } as any);
      prisma.outboundDraft.create.mockResolvedValue({
        id: 'ob1',
        status: 'DRAFT',
        channel: 'WHATSAPP',
        content: 'Hello!',
      } as any);

      const result = await service.createDraft({
        businessId: 'biz1',
        customerId: 'cust1',
        staffId: 'staff1',
        content: 'Hello!',
      });

      expect(result.status).toBe('DRAFT');
      expect(prisma.outboundDraft.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          customerId: 'cust1',
          channel: 'WHATSAPP',
          status: 'DRAFT',
        }),
        include: { customer: true, staff: true },
      });
    });

    it('throws when customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.createDraft({
          businessId: 'biz1',
          customerId: 'nonexistent',
          staffId: 'staff1',
          content: 'Hi',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated drafts', async () => {
      prisma.outboundDraft.findMany.mockResolvedValue([{ id: 'ob1' }] as any);
      prisma.outboundDraft.count.mockResolvedValue(1);

      const result = await service.findAll('biz1', {});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters by status', async () => {
      prisma.outboundDraft.findMany.mockResolvedValue([]);
      prisma.outboundDraft.count.mockResolvedValue(0);

      await service.findAll('biz1', { status: 'DRAFT' });

      expect(prisma.outboundDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('filters by customerId', async () => {
      prisma.outboundDraft.findMany.mockResolvedValue([]);
      prisma.outboundDraft.count.mockResolvedValue(0);

      await service.findAll('biz1', { customerId: 'cust1' });

      expect(prisma.outboundDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'cust1' }),
        }),
      );
    });
  });

  describe('approve', () => {
    it('approves a draft', async () => {
      prisma.outboundDraft.findFirst.mockResolvedValue({
        id: 'ob1',
        status: 'DRAFT',
        businessId: 'biz1',
      } as any);
      prisma.outboundDraft.update.mockResolvedValue({
        id: 'ob1',
        status: 'APPROVED',
        approvedById: 'staff1',
      } as any);

      const result = await service.approve('biz1', 'ob1', 'staff1');

      expect(result.status).toBe('APPROVED');
    });

    it('throws when draft not found', async () => {
      prisma.outboundDraft.findFirst.mockResolvedValue(null);

      await expect(service.approve('biz1', 'nonexistent', 'staff1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when draft is not in DRAFT status', async () => {
      prisma.outboundDraft.findFirst.mockResolvedValue({
        id: 'ob1',
        status: 'SENT',
      } as any);

      await expect(service.approve('biz1', 'ob1', 'staff1')).rejects.toThrow(BadRequestException);
    });

    it('logs audit entry on approve', async () => {
      prisma.outboundDraft.findFirst.mockResolvedValue({
        id: 'ob1',
        status: 'DRAFT',
        businessId: 'biz1',
        conversationId: null,
      } as any);
      prisma.outboundDraft.update.mockResolvedValue({ id: 'ob1', status: 'APPROVED' } as any);

      await service.approve('biz1', 'ob1', 'staff1');

      expect(actionHistoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OUTBOUND_APPROVED',
          actorId: 'staff1',
        }),
      );
    });
  });

  describe('reject', () => {
    it('rejects a draft', async () => {
      prisma.outboundDraft.findFirst.mockResolvedValue({
        id: 'ob1',
        status: 'DRAFT',
      } as any);
      prisma.outboundDraft.update.mockResolvedValue({
        id: 'ob1',
        status: 'REJECTED',
      } as any);

      const result = await service.reject('biz1', 'ob1');

      expect(result.status).toBe('REJECTED');
    });

    it('throws when not in DRAFT status', async () => {
      prisma.outboundDraft.findFirst.mockResolvedValue({
        id: 'ob1',
        status: 'APPROVED',
      } as any);

      await expect(service.reject('biz1', 'ob1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markSent', () => {
    it('marks draft as sent with conversation link', async () => {
      prisma.outboundDraft.update.mockResolvedValue({
        id: 'ob1',
        status: 'SENT',
        conversationId: 'conv1',
      } as any);

      const result = await service.markSent('biz1', 'ob1', 'conv1');

      expect(result.status).toBe('SENT');
      expect(prisma.outboundDraft.update).toHaveBeenCalledWith({
        where: { id: 'ob1', businessId: 'biz1' },
        data: expect.objectContaining({
          status: 'SENT',
          conversationId: 'conv1',
        }),
      });
    });
  });
});
