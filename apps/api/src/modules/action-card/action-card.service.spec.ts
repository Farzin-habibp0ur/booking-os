import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ActionCardService } from './action-card.service';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { createMockPrisma, createMockActionHistoryService } from '../../test/mocks';

function createMockInboxGateway() {
  return { emitToBusinessRoom: jest.fn() };
}

describe('ActionCardService', () => {
  let service: ActionCardService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let actionHistoryService: ReturnType<typeof createMockActionHistoryService>;
  let inboxGateway: ReturnType<typeof createMockInboxGateway>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    actionHistoryService = createMockActionHistoryService();
    inboxGateway = createMockInboxGateway();

    const module = await Test.createTestingModule({
      providers: [
        ActionCardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActionHistoryService, useValue: actionHistoryService },
        { provide: InboxGateway, useValue: inboxGateway },
      ],
    }).compile();

    service = module.get(ActionCardService);
  });

  describe('create', () => {
    const cardData = {
      businessId: 'biz1',
      type: 'DEPOSIT_PENDING',
      category: 'URGENT_TODAY',
      title: 'Deposit needed',
      description: 'Because booking is pending deposit',
      bookingId: 'book1',
      customerId: 'cust1',
    };

    it('creates a card with defaults', async () => {
      const card = { id: 'card1', ...cardData, status: 'PENDING', priority: 50 };
      prisma.actionCard.create.mockResolvedValue(card as any);

      const result = await service.create(cardData);

      expect(result).toEqual(card);
      expect(prisma.actionCard.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          type: 'DEPOSIT_PENDING',
          category: 'URGENT_TODAY',
          priority: 50,
          autonomyLevel: 'ASSISTED',
        }),
        include: { customer: true, booking: true, staff: true },
      });
    });

    it('emits WebSocket event on create', async () => {
      const card = { id: 'card1', ...cardData };
      prisma.actionCard.create.mockResolvedValue(card as any);

      await service.create(cardData);

      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith('biz1', 'action-card:new', {
        card,
      });
    });

    it('uses custom priority and autonomy level', async () => {
      const card = { id: 'card1', ...cardData, priority: 90, autonomyLevel: 'AUTO' };
      prisma.actionCard.create.mockResolvedValue(card as any);

      await service.create({ ...cardData, priority: 90, autonomyLevel: 'AUTO' });

      expect(prisma.actionCard.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 90,
          autonomyLevel: 'AUTO',
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated results with defaults', async () => {
      const items = [{ id: 'card1' }, { id: 'card2' }];
      prisma.actionCard.findMany.mockResolvedValue(items as any);
      prisma.actionCard.count.mockResolvedValue(2);

      const result = await service.findAll('biz1', {});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('filters by status', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.actionCard.count.mockResolvedValue(0);

      await service.findAll('biz1', { status: 'PENDING' });

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz1', status: 'PENDING' }),
        }),
      );
    });

    it('filters by category', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.actionCard.count.mockResolvedValue(0);

      await service.findAll('biz1', { category: 'URGENT_TODAY' });

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'URGENT_TODAY' }),
        }),
      );
    });

    it('filters by type', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.actionCard.count.mockResolvedValue(0);

      await service.findAll('biz1', { type: 'DEPOSIT_PENDING' });

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'DEPOSIT_PENDING' }),
        }),
      );
    });

    it('filters by staffId', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.actionCard.count.mockResolvedValue(0);

      await service.findAll('biz1', { staffId: 'staff1' });

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ staffId: 'staff1' }),
        }),
      );
    });

    it('caps pageSize at 100', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.actionCard.count.mockResolvedValue(0);

      await service.findAll('biz1', { pageSize: 500 });

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('orders by priority desc then createdAt desc', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);
      prisma.actionCard.count.mockResolvedValue(0);

      await service.findAll('biz1', {});

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns card with relations', async () => {
      const card = { id: 'card1', businessId: 'biz1', type: 'DEPOSIT_PENDING' };
      prisma.actionCard.findFirst.mockResolvedValue(card as any);

      const result = await service.findById('biz1', 'card1');

      expect(result).toEqual(card);
    });

    it('throws NotFoundException when card not found', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await expect(service.findById('biz1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('approves a pending card', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'PENDING',
        title: 'Test',
      } as any);
      prisma.actionCard.update.mockResolvedValue({
        id: 'card1',
        status: 'APPROVED',
        resolvedById: 'staff1',
      } as any);

      const result = await service.approve('biz1', 'card1', 'staff1', 'Sarah');

      expect(result.status).toBe('APPROVED');
      expect(prisma.actionCard.update).toHaveBeenCalledWith({
        where: { id: 'card1' },
        data: expect.objectContaining({ status: 'APPROVED', resolvedById: 'staff1' }),
        include: expect.any(Object),
      });
    });

    it('emits WebSocket event on approve', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'PENDING',
        title: 'Test',
      } as any);
      prisma.actionCard.update.mockResolvedValue({ id: 'card1', status: 'APPROVED' } as any);

      await service.approve('biz1', 'card1', 'staff1');

      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'action-card:updated',
        expect.any(Object),
      );
    });

    it('logs audit entry on approve', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'PENDING',
        title: 'Test',
      } as any);
      prisma.actionCard.update.mockResolvedValue({ id: 'card1', status: 'APPROVED' } as any);

      await service.approve('biz1', 'card1', 'staff1', 'Sarah');

      expect(actionHistoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CARD_APPROVED',
          entityType: 'ACTION_CARD',
          entityId: 'card1',
        }),
      );
    });

    it('throws NotFoundException when card not found', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await expect(service.approve('biz1', 'nonexistent', 'staff1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when card is not PENDING', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        status: 'APPROVED',
      } as any);

      await expect(service.approve('biz1', 'card1', 'staff1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('dismiss', () => {
    it('dismisses a pending card', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'PENDING',
        title: 'Test',
      } as any);
      prisma.actionCard.update.mockResolvedValue({ id: 'card1', status: 'DISMISSED' } as any);

      const result = await service.dismiss('biz1', 'card1', 'staff1');

      expect(result.status).toBe('DISMISSED');
    });

    it('throws when card is not PENDING', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        status: 'EXECUTED',
      } as any);

      await expect(service.dismiss('biz1', 'card1', 'staff1')).rejects.toThrow(BadRequestException);
    });

    it('logs audit entry on dismiss', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'PENDING',
        title: 'Test',
      } as any);
      prisma.actionCard.update.mockResolvedValue({ id: 'card1', status: 'DISMISSED' } as any);

      await service.dismiss('biz1', 'card1', 'staff1', 'Sarah');

      expect(actionHistoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CARD_DISMISSED',
          entityType: 'ACTION_CARD',
        }),
      );
    });
  });

  describe('snooze', () => {
    it('snoozes a pending card', async () => {
      const until = new Date('2026-02-19T09:00:00Z');
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'PENDING',
      } as any);
      prisma.actionCard.update.mockResolvedValue({
        id: 'card1',
        status: 'SNOOZED',
        snoozedUntil: until,
      } as any);

      const result = await service.snooze('biz1', 'card1', until, 'staff1');

      expect(result.status).toBe('SNOOZED');
      expect(prisma.actionCard.update).toHaveBeenCalledWith({
        where: { id: 'card1' },
        data: { status: 'SNOOZED', snoozedUntil: until },
        include: expect.any(Object),
      });
    });

    it('throws when card is not PENDING', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        status: 'DISMISSED',
      } as any);

      await expect(service.snooze('biz1', 'card1', new Date(), 'staff1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when card not found', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await expect(service.snooze('biz1', 'nonexistent', new Date(), 'staff1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('execute', () => {
    it('executes a pending card', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'PENDING',
        title: 'Test',
      } as any);
      prisma.actionCard.update.mockResolvedValue({ id: 'card1', status: 'EXECUTED' } as any);

      const result = await service.execute('biz1', 'card1', 'staff1');

      expect(result.status).toBe('EXECUTED');
    });

    it('executes an approved card', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'APPROVED',
        title: 'Test',
      } as any);
      prisma.actionCard.update.mockResolvedValue({ id: 'card1', status: 'EXECUTED' } as any);

      const result = await service.execute('biz1', 'card1', 'staff1');

      expect(result.status).toBe('EXECUTED');
    });

    it('throws when card is DISMISSED', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        status: 'DISMISSED',
      } as any);

      await expect(service.execute('biz1', 'card1', 'staff1')).rejects.toThrow(BadRequestException);
    });

    it('logs audit entry on execute', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'card1',
        businessId: 'biz1',
        status: 'PENDING',
        title: 'Test',
      } as any);
      prisma.actionCard.update.mockResolvedValue({ id: 'card1', status: 'EXECUTED' } as any);

      await service.execute('biz1', 'card1', 'staff1', 'Sarah');

      expect(actionHistoryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CARD_EXECUTED',
          entityType: 'ACTION_CARD',
        }),
      );
    });
  });

  describe('getPendingCount', () => {
    it('returns pending count for business', async () => {
      prisma.actionCard.count.mockResolvedValue(5);

      const result = await service.getPendingCount('biz1');

      expect(result).toBe(5);
      expect(prisma.actionCard.count).toHaveBeenCalledWith({
        where: { businessId: 'biz1', status: 'PENDING' },
      });
    });

    it('filters by staffId when provided', async () => {
      prisma.actionCard.count.mockResolvedValue(2);

      await service.getPendingCount('biz1', 'staff1');

      expect(prisma.actionCard.count).toHaveBeenCalledWith({
        where: { businessId: 'biz1', status: 'PENDING', staffId: 'staff1' },
      });
    });
  });

  describe('expireCards', () => {
    it('expires pending cards past their expiry date', async () => {
      prisma.actionCard.updateMany.mockResolvedValue({ count: 3 });

      await service.expireCards();

      expect(prisma.actionCard.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          expiresAt: { lte: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      });
    });

    it('logs when cards are expired', async () => {
      prisma.actionCard.updateMany.mockResolvedValue({ count: 2 });
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.expireCards();

      expect(logSpy).toHaveBeenCalledWith('Expired 2 action card(s)');
    });

    it('does not log when no cards expired', async () => {
      prisma.actionCard.updateMany.mockResolvedValue({ count: 0 });
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.expireCards();

      expect(logSpy).not.toHaveBeenCalled();
    });
  });

  describe('unsnoozCards', () => {
    it('unsnoozes cards past their snooze date', async () => {
      prisma.actionCard.updateMany.mockResolvedValue({ count: 1 });

      await service.unsnoozCards();

      expect(prisma.actionCard.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'SNOOZED',
          snoozedUntil: { lte: expect.any(Date) },
        },
        data: { status: 'PENDING', snoozedUntil: null },
      });
    });
  });
});
