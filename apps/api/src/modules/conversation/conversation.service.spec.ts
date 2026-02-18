import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConversationService', () => {
  let service: ConversationService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [ConversationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ConversationService);
  });

  // ─── findAll ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    const mockConversations = [
      {
        id: 'conv1',
        status: 'OPEN',
        lastMessageAt: new Date('2026-01-01T10:00:00Z'),
        assignedToId: null,
        messages: [{ direction: 'INBOUND' }],
      },
    ];

    beforeEach(() => {
      prisma.conversation.findMany.mockResolvedValue(mockConversations as any);
      prisma.conversation.count.mockResolvedValue(1);
    });

    it('returns paginated conversations with default page/pageSize', async () => {
      const result = await service.findAll('biz1', {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('respects custom page and pageSize', async () => {
      await service.findAll('biz1', { page: 2, pageSize: 10 });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('filters by named filter: unassigned', async () => {
      await service.findAll('biz1', { filter: 'unassigned' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: null,
            status: { not: 'RESOLVED' },
          }),
        }),
      );
    });

    it('filters by named filter: overdue', async () => {
      await service.findAll('biz1', { filter: 'overdue' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'OPEN',
            metadata: { path: ['isOverdue'], equals: true },
          }),
        }),
      );
    });

    it('filters by named filter: waiting', async () => {
      await service.findAll('biz1', { filter: 'waiting' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'WAITING' }),
        }),
      );
    });

    it('filters by named filter: snoozed', async () => {
      await service.findAll('biz1', { filter: 'snoozed' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SNOOZED' }),
        }),
      );
    });

    it('filters by named filter: closed', async () => {
      await service.findAll('biz1', { filter: 'closed' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'RESOLVED' }),
        }),
      );
    });

    it('filters by named filter: mine with assignedToId', async () => {
      await service.findAll('biz1', { filter: 'mine', assignedToId: 'staff1' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: 'staff1',
            status: { not: 'RESOLVED' },
          }),
        }),
      );
    });

    it('filters by default (all non-resolved) for unknown filter', async () => {
      await service.findAll('biz1', { filter: 'all' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: 'RESOLVED' } }),
        }),
      );
    });

    it('uses legacy params when no filter provided', async () => {
      await service.findAll('biz1', { status: 'OPEN', assignedToId: 'staff1' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'OPEN',
            assignedToId: 'staff1',
          }),
        }),
      );
    });

    it('handles unassigned legacy param', async () => {
      await service.findAll('biz1', { unassigned: true });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ assignedToId: null }),
        }),
      );
    });

    it('applies search filter on customer name or phone', async () => {
      await service.findAll('biz1', { search: 'Emma' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customer: {
              OR: [
                { name: { contains: 'Emma', mode: 'insensitive' } },
                { phone: { contains: 'Emma' } },
              ],
            },
          }),
        }),
      );
    });

    it('enriches conversations with isOverdue and isNew flags', async () => {
      const oldDate = new Date(Date.now() - 20 * 60 * 1000); // 20 mins ago
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv1',
          status: 'OPEN',
          lastMessageAt: oldDate,
          assignedToId: null,
          messages: [{ direction: 'INBOUND' }],
        },
      ] as any);

      const result = await service.findAll('biz1', {});

      expect(result.data[0]).toHaveProperty('isOverdue');
      expect(result.data[0]).toHaveProperty('isNew');
      expect(result.data[0].isOverdue).toBe(true);
      expect(result.data[0].isNew).toBe(true);
    });
  });

  // ─── getFilterCounts ─────────────────────────────────────────────────

  describe('getFilterCounts', () => {
    beforeEach(() => {
      prisma.conversation.count.mockResolvedValue(10);
      prisma.conversation.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }] as any);
    });

    it('returns all filter counts', async () => {
      const result = await service.getFilterCounts('biz1', 'staff1');

      expect(result).toHaveProperty('all');
      expect(result).toHaveProperty('unassigned');
      expect(result).toHaveProperty('mine');
      expect(result).toHaveProperty('overdue');
      expect(result).toHaveProperty('waiting');
      expect(result).toHaveProperty('snoozed');
      expect(result).toHaveProperty('closed');
    });

    it('returns 0 for mine when no staffId provided', async () => {
      const result = await service.getFilterCounts('biz1');

      expect(result.mine).toBe(0);
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns conversation scoped to business', async () => {
      const conv = { id: 'conv1', businessId: 'biz1' };
      prisma.conversation.findFirst.mockResolvedValue(conv as any);

      const result = await service.findById('biz1', 'conv1');

      expect(result).toEqual(conv);
      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv1', businessId: 'biz1' },
        include: {
          customer: true,
          assignedTo: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });
    });
  });

  // ─── findOrCreate ─────────────────────────────────────────────────────

  describe('findOrCreate', () => {
    it('returns active conversation if one exists', async () => {
      const existing = { id: 'conv1', status: 'OPEN' };
      prisma.conversation.findFirst.mockResolvedValue(existing as any);

      const result = await service.findOrCreate('biz1', 'cust1');

      expect(result).toEqual(existing);
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('reopens resolved conversation if no active one exists', async () => {
      prisma.conversation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'conv1', status: 'RESOLVED' } as any);
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', status: 'OPEN' } as any);

      const result = await service.findOrCreate('biz1', 'cust1');

      expect(result.status).toBe('OPEN');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { status: 'OPEN' },
      });
    });

    it('creates new conversation if none exist', async () => {
      prisma.conversation.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.conversation.create.mockResolvedValue({ id: 'conv-new', status: 'OPEN' } as any);

      const result = await service.findOrCreate('biz1', 'cust1');

      expect(result.id).toBe('conv-new');
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', customerId: 'cust1', channel: 'WHATSAPP', status: 'OPEN' },
      });
    });

    it('uses custom channel', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' } as any);

      await service.findOrCreate('biz1', 'cust1', 'SMS');

      expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ channel: 'SMS' }),
        }),
      );
    });

    it('sets locationId when creating new conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      prisma.conversation.create.mockResolvedValue({
        id: 'conv-new',
        status: 'OPEN',
        locationId: 'loc1',
      } as any);

      const result = await service.findOrCreate('biz1', 'cust1', 'WHATSAPP', 'loc1');

      expect(result.locationId).toBe('loc1');
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          customerId: 'cust1',
          channel: 'WHATSAPP',
          status: 'OPEN',
          locationId: 'loc1',
        },
      });
    });

    it('updates locationId on existing conversation if not already set', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        status: 'OPEN',
        locationId: null,
      } as any);
      prisma.conversation.update.mockResolvedValue({
        id: 'conv1',
        status: 'OPEN',
        locationId: 'loc1',
      } as any);

      const result = await service.findOrCreate('biz1', 'cust1', 'WHATSAPP', 'loc1');

      expect(result.locationId).toBe('loc1');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { locationId: 'loc1' },
      });
    });

    it('does not update locationId if already set on existing conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        status: 'OPEN',
        locationId: 'loc-existing',
      } as any);

      const result = await service.findOrCreate('biz1', 'cust1', 'WHATSAPP', 'loc-new');

      expect(result.locationId).toBe('loc-existing');
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });

    it('sets locationId when reopening resolved conversation', async () => {
      prisma.conversation.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'conv1', status: 'RESOLVED' } as any);
      prisma.conversation.update.mockResolvedValue({
        id: 'conv1',
        status: 'OPEN',
        locationId: 'loc1',
      } as any);

      const result = await service.findOrCreate('biz1', 'cust1', 'WHATSAPP', 'loc1');

      expect(result.status).toBe('OPEN');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { status: 'OPEN', locationId: 'loc1' },
      });
    });
  });

  // ─── findAll (location filter) ────────────────────────────────────────

  describe('findAll (location filter)', () => {
    beforeEach(() => {
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.count.mockResolvedValue(0);
    });

    it('includes locationId in where clause when provided', async () => {
      await service.findAll('biz1', { locationId: 'loc1' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ locationId: 'loc1' }),
        }),
      );
    });

    it('does not filter by locationId when not provided', async () => {
      await service.findAll('biz1', {});

      const callArg = (prisma.conversation.findMany.mock.calls[0] as any)?.[0];
      expect(callArg?.where).not.toHaveProperty('locationId');
    });
  });

  // ─── snooze ───────────────────────────────────────────────────────────

  describe('snooze', () => {
    it('updates status to SNOOZED with snoozedUntil date', async () => {
      const until = new Date('2026-03-01T12:00:00Z');
      prisma.conversation.update.mockResolvedValue({
        id: 'conv1',
        status: 'SNOOZED',
        snoozedUntil: until,
      } as any);

      const result = await service.snooze('biz1', 'conv1', until);

      expect(result.status).toBe('SNOOZED');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1', businessId: 'biz1' },
        data: { status: 'SNOOZED', snoozedUntil: until },
        include: { customer: true, assignedTo: { select: { id: true, name: true } } },
      });
    });
  });

  // ─── unsnoozeOverdue ──────────────────────────────────────────────────

  describe('unsnoozeOverdue', () => {
    it('reopens conversations past snoozedUntil and returns count', async () => {
      const snoozed = [
        { id: 'conv1', status: 'SNOOZED' },
        { id: 'conv2', status: 'SNOOZED' },
      ];
      prisma.conversation.findMany.mockResolvedValue(snoozed as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      const count = await service.unsnoozeOverdue();

      expect(count).toBe(2);
      expect(prisma.conversation.update).toHaveBeenCalledTimes(2);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { status: 'OPEN', snoozedUntil: null },
      });
    });

    it('returns 0 when no snoozed conversations are overdue', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);

      const count = await service.unsnoozeOverdue();

      expect(count).toBe(0);
    });
  });

  // ─── handleSnoozedConversations ───────────────────────────────────────

  describe('handleSnoozedConversations', () => {
    it('calls unsnoozeOverdue and logs when count > 0', async () => {
      prisma.conversation.findMany.mockResolvedValue([{ id: 'conv1' }] as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();
      await service.handleSnoozedConversations();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Reopened 1'));
      logSpy.mockRestore();
    });

    it('does not log when count is 0', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);

      const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();
      await service.handleSnoozedConversations();

      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  // ─── getNotes ─────────────────────────────────────────────────────────

  describe('getNotes', () => {
    it('returns notes for conversation scoped to business', async () => {
      const notes = [{ id: 'n1', content: 'Hello' }];
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1', businessId: 'biz1' } as any);
      prisma.conversationNote.findMany.mockResolvedValue(notes as any);

      const result = await service.getNotes('biz1', 'conv1');

      expect(result).toEqual(notes);
    });

    it('returns empty array when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      const result = await service.getNotes('biz1', 'conv1');

      expect(result).toEqual([]);
    });
  });

  // ─── addNote ──────────────────────────────────────────────────────────

  describe('addNote', () => {
    it('creates a note with staff reference', async () => {
      const note = { id: 'n1', content: 'Note text', staffId: 'staff1' };
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' } as any);
      prisma.conversationNote.create.mockResolvedValue(note as any);

      const result = await service.addNote('biz1', 'conv1', 'staff1', 'Note text');

      expect(result).toEqual(note);
    });

    it('throws NotFoundException when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(service.addNote('biz1', 'conv1', 'staff1', 'text')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── deleteNote ───────────────────────────────────────────────────────

  describe('deleteNote', () => {
    it('deletes note by id scoped to business', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' } as any);
      prisma.conversationNote.delete.mockResolvedValue({ id: 'n1' } as any);

      await service.deleteNote('biz1', 'conv1', 'n1');

      expect(prisma.conversationNote.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    });

    it('throws NotFoundException when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(service.deleteNote('biz1', 'conv1', 'n1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateTags ───────────────────────────────────────────────────────

  describe('updateTags', () => {
    it('updates tags array', async () => {
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', tags: ['vip', 'new'] } as any);

      const result = await service.updateTags('biz1', 'conv1', ['vip', 'new']);

      expect(result.tags).toEqual(['vip', 'new']);
    });
  });

  // ─── assign ───────────────────────────────────────────────────────────

  describe('assign', () => {
    it('sets assignedToId', async () => {
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', assignedToId: 'staff1' } as any);

      const result = await service.assign('biz1', 'conv1', 'staff1');

      expect(result.assignedToId).toBe('staff1');
    });

    it('clears assignedToId with null', async () => {
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', assignedToId: null } as any);

      const result = await service.assign('biz1', 'conv1', null);

      expect(result.assignedToId).toBeNull();
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('updates conversation status', async () => {
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', status: 'RESOLVED' } as any);

      const result = await service.updateStatus('biz1', 'conv1', 'RESOLVED');

      expect(result.status).toBe('RESOLVED');
    });
  });

  // ─── getMessages ──────────────────────────────────────────────────────

  describe('getMessages', () => {
    it('returns empty array for missing conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      const result = await service.getMessages('biz1', 'nonexistent');

      expect(result).toEqual([]);
    });

    it('returns ordered messages for existing conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' } as any);
      const messages = [
        { id: 'm1', createdAt: new Date('2026-01-01') },
        { id: 'm2', createdAt: new Date('2026-01-02') },
      ];
      prisma.message.findMany.mockResolvedValue(messages as any);

      const result = await service.getMessages('biz1', 'conv1');

      expect(result).toEqual(messages);
    });
  });
});
