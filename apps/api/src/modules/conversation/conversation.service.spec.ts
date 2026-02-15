import { Test } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConversationService', () => {
  let conversationService: ConversationService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    conversationService = module.get(ConversationService);
  });

  describe('findOrCreate', () => {
    it('returns active conversation if one exists', async () => {
      const existing = { id: 'conv1', status: 'OPEN' };
      prisma.conversation.findFirst.mockResolvedValue(existing as any);

      const result = await conversationService.findOrCreate('biz1', 'cust1');

      expect(result).toEqual(existing);
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('reopens resolved conversation if no active one exists', async () => {
      prisma.conversation.findFirst
        .mockResolvedValueOnce(null) // no active
        .mockResolvedValueOnce({ id: 'conv1', status: 'RESOLVED' } as any); // found resolved
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', status: 'OPEN' } as any);

      const result = await conversationService.findOrCreate('biz1', 'cust1');

      expect(result.status).toBe('OPEN');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { status: 'OPEN' },
      });
    });

    it('creates new conversation if none exist', async () => {
      prisma.conversation.findFirst
        .mockResolvedValueOnce(null) // no active
        .mockResolvedValueOnce(null); // no resolved
      prisma.conversation.create.mockResolvedValue({ id: 'conv-new', status: 'OPEN' } as any);

      const result = await conversationService.findOrCreate('biz1', 'cust1');

      expect(result.id).toBe('conv-new');
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', customerId: 'cust1', channel: 'WHATSAPP', status: 'OPEN' },
      });
    });
  });

  describe('snooze', () => {
    it('updates status to SNOOZED with snoozedUntil date', async () => {
      const until = new Date('2026-03-01T12:00:00Z');
      prisma.conversation.update.mockResolvedValue({
        id: 'conv1', status: 'SNOOZED', snoozedUntil: until,
      } as any);

      const result = await conversationService.snooze('biz1', 'conv1', until);

      expect(result.status).toBe('SNOOZED');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1', businessId: 'biz1' },
        data: { status: 'SNOOZED', snoozedUntil: until },
        include: { customer: true, assignedTo: { select: { id: true, name: true } } },
      });
    });
  });

  describe('unsnoozeOverdue', () => {
    it('reopens conversations past snoozedUntil and returns count', async () => {
      const snoozed = [
        { id: 'conv1', status: 'SNOOZED' },
        { id: 'conv2', status: 'SNOOZED' },
      ];
      prisma.conversation.findMany.mockResolvedValue(snoozed as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      const count = await conversationService.unsnoozeOverdue();

      expect(count).toBe(2);
      expect(prisma.conversation.update).toHaveBeenCalledTimes(2);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { status: 'OPEN', snoozedUntil: null },
      });
    });

    it('returns 0 when no snoozed conversations are overdue', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);

      const count = await conversationService.unsnoozeOverdue();

      expect(count).toBe(0);
    });
  });

  describe('getNotes', () => {
    it('returns notes for conversation scoped to business', async () => {
      const notes = [{ id: 'n1', content: 'Hello' }];
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1', businessId: 'biz1' } as any);
      prisma.conversationNote.findMany.mockResolvedValue(notes as any);

      const result = await conversationService.getNotes('biz1', 'conv1');

      expect(result).toEqual(notes);
      expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'conv1', businessId: 'biz1' },
      });
      expect(prisma.conversationNote.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv1' },
        include: { staff: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      const result = await conversationService.getNotes('biz1', 'conv1');

      expect(result).toEqual([]);
    });
  });

  describe('addNote', () => {
    it('creates a note with staff reference scoped to business', async () => {
      const note = { id: 'n1', content: 'Note text', staffId: 'staff1' };
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1', businessId: 'biz1' } as any);
      prisma.conversationNote.create.mockResolvedValue(note as any);

      const result = await conversationService.addNote('biz1', 'conv1', 'staff1', 'Note text');

      expect(result).toEqual(note);
      expect(prisma.conversationNote.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv1', staffId: 'staff1', content: 'Note text' },
        include: { staff: { select: { id: true, name: true } } },
      });
    });

    it('throws when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(conversationService.addNote('biz1', 'conv1', 'staff1', 'text'))
        .rejects.toThrow('Conversation not found');
    });
  });

  describe('deleteNote', () => {
    it('deletes note by id scoped to business', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1', businessId: 'biz1' } as any);
      prisma.conversationNote.delete.mockResolvedValue({ id: 'n1' } as any);

      await conversationService.deleteNote('biz1', 'conv1', 'n1');

      expect(prisma.conversationNote.delete).toHaveBeenCalledWith({
        where: { id: 'n1' },
      });
    });

    it('throws when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(conversationService.deleteNote('biz1', 'conv1', 'n1'))
        .rejects.toThrow('Conversation not found');
    });
  });

  describe('updateTags', () => {
    it('updates tags array', async () => {
      prisma.conversation.update.mockResolvedValue({
        id: 'conv1', tags: ['vip', 'new'],
      } as any);

      const result = await conversationService.updateTags('biz1', 'conv1', ['vip', 'new']);

      expect(result.tags).toEqual(['vip', 'new']);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1', businessId: 'biz1' },
        data: { tags: ['vip', 'new'] },
        include: { customer: true, assignedTo: { select: { id: true, name: true } } },
      });
    });
  });

  describe('assign', () => {
    it('sets assignedToId', async () => {
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', assignedToId: 'staff1' } as any);

      const result = await conversationService.assign('biz1', 'conv1', 'staff1');

      expect(result.assignedToId).toBe('staff1');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1', businessId: 'biz1' },
        data: { assignedToId: 'staff1' },
        include: { customer: true, assignedTo: { select: { id: true, name: true } } },
      });
    });

    it('clears assignedToId with null', async () => {
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', assignedToId: null } as any);

      const result = await conversationService.assign('biz1', 'conv1', null);

      expect(result.assignedToId).toBeNull();
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assignedToId: null },
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('updates conversation status', async () => {
      prisma.conversation.update.mockResolvedValue({ id: 'conv1', status: 'RESOLVED' } as any);

      const result = await conversationService.updateStatus('biz1', 'conv1', 'RESOLVED');

      expect(result.status).toBe('RESOLVED');
    });
  });

  describe('getMessages', () => {
    it('returns empty array for missing conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      const result = await conversationService.getMessages('biz1', 'nonexistent');

      expect(result).toEqual([]);
      expect(prisma.message.findMany).not.toHaveBeenCalled();
    });

    it('returns ordered messages for existing conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' } as any);
      const messages = [
        { id: 'm1', createdAt: new Date('2026-01-01') },
        { id: 'm2', createdAt: new Date('2026-01-02') },
      ];
      prisma.message.findMany.mockResolvedValue(messages as any);

      const result = await conversationService.getMessages('biz1', 'conv1');

      expect(result).toEqual(messages);
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv1' },
        include: { senderStaff: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
