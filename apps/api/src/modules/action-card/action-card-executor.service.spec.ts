import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ActionCardExecutorService } from './action-card-executor.service';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { OutboundService } from '../outbound/outbound.service';
import { CustomerIdentityService } from '../customer-identity/customer-identity.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { createMockPrisma } from '../../test/mocks';

function createMockInboxGateway() {
  return { emitToBusinessRoom: jest.fn() };
}

describe('ActionCardExecutorService — FIX-05 & FIX-06', () => {
  let service: ActionCardExecutorService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let inboxGateway: ReturnType<typeof createMockInboxGateway>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    inboxGateway = createMockInboxGateway();

    const module = await Test.createTestingModule({
      providers: [
        ActionCardExecutorService,
        { provide: PrismaService, useValue: prisma },
        { provide: InboxGateway, useValue: inboxGateway },
        { provide: OutboundService, useValue: { createDraft: jest.fn() } },
        { provide: CustomerIdentityService, useValue: { getCustomerChannels: jest.fn() } },
        { provide: getQueueToken(QUEUE_NAMES.AI_PROCESSING), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get(ActionCardExecutorService);
  });

  // ─── FIX-05: check_waitlist ───────────────────────────────────────────────

  describe('check_waitlist CTA handler', () => {
    it('returns error when card metadata has no date', async () => {
      const card = { id: 'ac1', metadata: {}, preview: {} };

      const result = await service.executeCta('biz1', card, 'check_waitlist', 'staff1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No date in card metadata');
    });

    it('emits action-card:updated with waitlist matches', async () => {
      const card = { id: 'ac1', metadata: { date: '2026-04-10', staffId: 'staff1' }, preview: {} };

      prisma.waitlistEntry.findMany.mockResolvedValue([
        {
          id: 'w1',
          customerId: 'c1',
          customer: { name: 'Alice' },
          service: { name: 'Facial' },
        },
      ] as any);

      const result = await service.executeCta('biz1', card, 'check_waitlist', 'staff1');

      expect(result.success).toBe(true);
      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'action-card:updated',
        expect.objectContaining({
          actionCardId: 'ac1',
          waitlistMatches: [
            expect.objectContaining({ customerName: 'Alice', serviceName: 'Facial' }),
          ],
        }),
      );
    });

    it('returns success with no-match error when waitlist is empty', async () => {
      const card = { id: 'ac1', metadata: { date: '2026-04-10' }, preview: {} };
      prisma.waitlistEntry.findMany.mockResolvedValue([] as any);

      const result = await service.executeCta('biz1', card, 'check_waitlist', 'staff1');

      expect(result.success).toBe(true);
      expect(result.error).toContain('No matching waitlist entries');
      expect(inboxGateway.emitToBusinessRoom).not.toHaveBeenCalled();
    });
  });

  // ─── FIX-06: merge ───────────────────────────────────────────────────────

  describe('merge CTA handler', () => {
    it('returns error when customer IDs are missing from preview', async () => {
      const card = { id: 'ac1', preview: {} };

      const result = await service.executeCta('biz1', card, 'merge', 'staff1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing customer IDs');
    });

    it('returns error when a customer is not found', async () => {
      const card = {
        id: 'ac1',
        preview: { customer1: { id: 'c1' }, customer2: { id: 'c2' } },
      };
      prisma.customer.findFirst
        .mockResolvedValueOnce({ id: 'c1' } as any)
        .mockResolvedValueOnce(null);

      const result = await service.executeCta('biz1', card, 'merge', 'staff1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('runs transaction: re-points bookings/conversations/actionCards and soft-deletes secondary', async () => {
      const primary = {
        id: 'c1',
        businessId: 'biz1',
        tags: ['vip'],
        email: 'a@x.com',
        phone: '+1',
      };
      const secondary = { id: 'c2', businessId: 'biz1', tags: ['new'], email: null, phone: null };
      const card = {
        id: 'ac1',
        preview: { customer1: { id: 'c1' }, customer2: { id: 'c2' } },
      };

      prisma.customer.findFirst
        .mockResolvedValueOnce(primary as any)
        .mockResolvedValueOnce(secondary as any);

      // Mock $transaction to call the callback with a tx proxy
      const txMock = {
        booking: { updateMany: jest.fn().mockResolvedValue({}) },
        conversation: { updateMany: jest.fn().mockResolvedValue({}) },
        actionCard: { updateMany: jest.fn().mockResolvedValue({}) },
        customer: { update: jest.fn().mockResolvedValue({}) },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(txMock));

      const result = await service.executeCta('biz1', card, 'merge', 'staff1');

      expect(result.success).toBe(true);
      expect(txMock.booking.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'c2', businessId: 'biz1' },
        data: { customerId: 'c1' },
      });
      expect(txMock.conversation.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'c2', businessId: 'biz1' },
        data: { customerId: 'c1' },
      });
      expect(txMock.actionCard.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'c2', businessId: 'biz1' },
        data: { customerId: 'c1' },
      });
      // Soft-delete secondary
      expect(txMock.customer.update).toHaveBeenCalledWith({
        where: { id: 'c2' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('merges tags from both customers', async () => {
      const primary = { id: 'c1', businessId: 'biz1', tags: ['vip'], email: null, phone: null };
      const secondary = {
        id: 'c2',
        businessId: 'biz1',
        tags: ['new', 'vip'],
        email: null,
        phone: null,
      };
      const card = { id: 'ac1', preview: { customer1: { id: 'c1' }, customer2: { id: 'c2' } } };

      prisma.customer.findFirst
        .mockResolvedValueOnce(primary as any)
        .mockResolvedValueOnce(secondary as any);

      const txMock = {
        booking: { updateMany: jest.fn().mockResolvedValue({}) },
        conversation: { updateMany: jest.fn().mockResolvedValue({}) },
        actionCard: { updateMany: jest.fn().mockResolvedValue({}) },
        customer: { update: jest.fn().mockResolvedValue({}) },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(txMock));

      await service.executeCta('biz1', card, 'merge', 'staff1');

      // Primary update should include merged tags (union, no duplicates)
      expect(txMock.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({ tags: expect.arrayContaining(['vip', 'new']) }),
        }),
      );
    });
  });
});
