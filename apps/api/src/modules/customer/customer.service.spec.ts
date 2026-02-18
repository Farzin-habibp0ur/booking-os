import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../../common/prisma.service';
import { ProfileExtractor } from '../ai/profile-extractor';
import { createMockPrisma } from '../../test/mocks';

describe('CustomerService', () => {
  let service: CustomerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockExtractor: { extract: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockExtractor = { extract: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfileExtractor, useValue: mockExtractor },
      ],
    }).compile();

    service = module.get(CustomerService);
  });

  // ─── findAll ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    beforeEach(() => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1', name: 'Emma' }] as any);
      prisma.customer.count.mockResolvedValue(1);
    });

    it('returns paginated customers', async () => {
      const result = await service.findAll('biz1', {});

      expect(result).toEqual({
        data: [{ id: 'c1', name: 'Emma' }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('applies search filter on name, phone, email', async () => {
      await service.findAll('biz1', { search: 'Emma' });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'Emma', mode: 'insensitive' } },
              { phone: { contains: 'Emma' } },
              { email: { contains: 'Emma', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('respects page and pageSize params', async () => {
      await service.findAll('biz1', { page: 3, pageSize: 5 });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns customer scoped to business', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'c1' } as any);
      const result = await service.findById('biz1', 'c1');
      expect(result).toEqual({ id: 'c1' });
    });
  });

  // ─── findOrCreateByPhone ──────────────────────────────────────────────

  describe('findOrCreateByPhone', () => {
    it('returns existing customer if found', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'c1', phone: '+123' } as any);

      const result = await service.findOrCreateByPhone('biz1', '+123');

      expect(result.id).toBe('c1');
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('creates new customer if not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'c-new', phone: '+123' } as any);

      const result = await service.findOrCreateByPhone('biz1', '+123', 'Emma');

      expect(result.id).toBe('c-new');
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', phone: '+123', name: 'Emma' },
      });
    });

    it('uses phone as name when name not provided', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'c-new' } as any);

      await service.findOrCreateByPhone('biz1', '+123');

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: '+123' }),
      });
    });
  });

  // ─── create ───────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates customer with all fields', async () => {
      prisma.customer.create.mockResolvedValue({ id: 'c1' } as any);

      await service.create('biz1', {
        name: 'Emma',
        phone: '+123',
        email: 'emma@test.com',
        tags: ['vip'],
      });

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          name: 'Emma',
          phone: '+123',
          email: 'emma@test.com',
          tags: ['vip'],
        },
      });
    });
  });

  // ─── update ───────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates customer fields', async () => {
      prisma.customer.update.mockResolvedValue({ id: 'c1', name: 'Updated' } as any);

      const result = await service.update('biz1', 'c1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1', businessId: 'biz1' },
        data: { name: 'Updated' },
      });
    });
  });

  // ─── getBookings ──────────────────────────────────────────────────────

  describe('getBookings', () => {
    it('returns bookings for customer with service and staff', async () => {
      const bookings = [{ id: 'b1', service: {}, staff: {} }];
      prisma.booking.findMany.mockResolvedValue(bookings as any);

      const result = await service.getBookings('biz1', 'c1');

      expect(result).toEqual(bookings);
      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', customerId: 'c1' },
        include: { service: true, staff: true },
        orderBy: { startTime: 'desc' },
      });
    });
  });

  // ─── getNotes ────────────────────────────────────────────────────────

  describe('getNotes', () => {
    it('returns notes for customer ordered by createdAt desc', async () => {
      const notes = [
        { id: 'n1', content: 'Note 1', staff: { id: 's1', name: 'Dr. Chen' } },
        { id: 'n2', content: 'Note 2', staff: { id: 's1', name: 'Dr. Chen' } },
      ];
      prisma.customerNote.findMany.mockResolvedValue(notes as any);

      const result = await service.getNotes('biz1', 'c1');

      expect(result).toEqual(notes);
      expect(prisma.customerNote.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', customerId: 'c1' },
        include: { staff: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when no notes exist', async () => {
      prisma.customerNote.findMany.mockResolvedValue([]);

      const result = await service.getNotes('biz1', 'c1');

      expect(result).toEqual([]);
    });
  });

  // ─── createNote ─────────────────────────────────────────────────────

  describe('createNote', () => {
    it('creates a note for a customer', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'c1' } as any);
      prisma.customerNote.create.mockResolvedValue({
        id: 'n1',
        content: 'Test note',
        staff: { id: 's1', name: 'Dr. Chen' },
      } as any);

      const result = await service.createNote('biz1', 'c1', 's1', 'Test note');

      expect(result.id).toBe('n1');
      expect(prisma.customerNote.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', customerId: 'c1', staffId: 's1', content: 'Test note' },
        include: { staff: { select: { id: true, name: true } } },
      });
    });

    it('trims whitespace from content', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'c1' } as any);
      prisma.customerNote.create.mockResolvedValue({ id: 'n1' } as any);

      await service.createNote('biz1', 'c1', 's1', '  trimmed  ');

      expect(prisma.customerNote.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ content: 'trimmed' }) }),
      );
    });

    it('throws when content is empty', async () => {
      await expect(service.createNote('biz1', 'c1', 's1', '')).rejects.toThrow(BadRequestException);
    });

    it('throws when content is only whitespace', async () => {
      await expect(service.createNote('biz1', 'c1', 's1', '   ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.createNote('biz1', 'c1', 's1', 'Note')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── updateNote ─────────────────────────────────────────────────────

  describe('updateNote', () => {
    it('updates note content when owned by staff', async () => {
      prisma.customerNote.findFirst.mockResolvedValue({ id: 'n1', staffId: 's1' } as any);
      prisma.customerNote.update.mockResolvedValue({ id: 'n1', content: 'Updated' } as any);

      const result = await service.updateNote('biz1', 'n1', 's1', 'Updated');

      expect(result.content).toBe('Updated');
      expect(prisma.customerNote.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { content: 'Updated' },
        include: { staff: { select: { id: true, name: true } } },
      });
    });

    it('throws when note not found', async () => {
      prisma.customerNote.findFirst.mockResolvedValue(null);

      await expect(service.updateNote('biz1', 'n1', 's1', 'Updated')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws when staff does not own the note', async () => {
      prisma.customerNote.findFirst.mockResolvedValue({ id: 'n1', staffId: 's2' } as any);

      await expect(service.updateNote('biz1', 'n1', 's1', 'Updated')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws when content is empty', async () => {
      await expect(service.updateNote('biz1', 'n1', 's1', '')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── deleteNote ─────────────────────────────────────────────────────

  describe('deleteNote', () => {
    it('deletes note when owned by staff', async () => {
      prisma.customerNote.findFirst.mockResolvedValue({ id: 'n1', staffId: 's1' } as any);
      prisma.customerNote.delete.mockResolvedValue({ id: 'n1' } as any);

      await service.deleteNote('biz1', 'n1', 's1');

      expect(prisma.customerNote.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    });

    it('throws when note not found', async () => {
      prisma.customerNote.findFirst.mockResolvedValue(null);

      await expect(service.deleteNote('biz1', 'n1', 's1')).rejects.toThrow(NotFoundException);
    });

    it('throws when staff does not own the note', async () => {
      prisma.customerNote.findFirst.mockResolvedValue({ id: 'n1', staffId: 's2' } as any);

      await expect(service.deleteNote('biz1', 'n1', 's1')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── bulkUpdate ───────────────────────────────────────────────────────

  describe('bulkUpdate', () => {
    it('throws when no IDs provided', async () => {
      await expect(service.bulkUpdate('biz1', [], 'tag', { tag: 'vip' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when more than 100 IDs', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `c${i}`);
      await expect(service.bulkUpdate('biz1', ids, 'tag', { tag: 'vip' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('adds tag to customers without it', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', tags: [] },
        { id: 'c2', tags: ['existing'] },
      ] as any);
      prisma.customer.update.mockResolvedValue({} as any);

      const result = await service.bulkUpdate('biz1', ['c1', 'c2'], 'tag', { tag: 'vip' });

      expect(result.updated).toBe(2);
      expect(prisma.customer.update).toHaveBeenCalledTimes(2);
    });

    it('skips customers already having the tag', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1', tags: ['vip'] }] as any);

      const result = await service.bulkUpdate('biz1', ['c1'], 'tag', { tag: 'vip' });

      expect(result.updated).toBe(0);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('removes tag from customers with untag action', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1', tags: ['vip', 'new'] }] as any);
      prisma.customer.update.mockResolvedValue({} as any);

      const result = await service.bulkUpdate('biz1', ['c1'], 'untag', { tag: 'vip' });

      expect(result.updated).toBe(1);
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { tags: ['new'] },
      });
    });

    it('skips untag when customer does not have the tag', async () => {
      prisma.customer.findMany.mockResolvedValue([{ id: 'c1', tags: ['other'] }] as any);

      const result = await service.bulkUpdate('biz1', ['c1'], 'untag', { tag: 'vip' });

      expect(result.updated).toBe(0);
    });

    it('throws for tag action without tag payload', async () => {
      await expect(service.bulkUpdate('biz1', ['c1'], 'tag', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws for untag action without tag payload', async () => {
      await expect(service.bulkUpdate('biz1', ['c1'], 'untag', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws for unknown action', async () => {
      await expect(service.bulkUpdate('biz1', ['c1'], 'delete' as any, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── bulkCreate ───────────────────────────────────────────────────────

  describe('bulkCreate', () => {
    it('creates new customers and skips existing ones', async () => {
      prisma.customer.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' } as any);
      prisma.customer.create.mockResolvedValue({} as any);

      const result = await service.bulkCreate('biz1', [
        { name: 'Emma', phone: '+111' },
        { name: 'Sara', phone: '+222' },
      ]);

      expect(result).toEqual({ created: 1, skipped: 1, errors: 0 });
    });

    it('counts errors for empty phone', async () => {
      const result = await service.bulkCreate('biz1', [{ name: 'Emma', phone: '' }]);

      expect(result.errors).toBe(1);
    });

    it('counts errors for create failures', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockRejectedValue(new Error('DB error'));

      const result = await service.bulkCreate('biz1', [{ name: 'Emma', phone: '+123' }]);

      expect(result.errors).toBe(1);
    });

    it('uses phone as name when name is empty', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({} as any);

      await service.bulkCreate('biz1', [{ name: '', phone: '+123' }]);

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: '+123' }),
      });
    });
  });

  // ─── createFromConversations ──────────────────────────────────────────

  describe('createFromConversations', () => {
    it('extracts profiles from conversations and updates customers', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv1',
          customer: { id: 'c1', name: '+123', phone: '+123', tags: [], customFields: {} },
          messages: [{ direction: 'INBOUND', content: 'Hi, I am Emma', createdAt: new Date() }],
        },
      ] as any);
      mockExtractor.extract.mockResolvedValue({
        name: 'Emma',
        email: 'emma@test.com',
        tags: ['new'],
        notes: 'Interested in botox',
      });
      prisma.customer.update.mockResolvedValue({} as any);

      const result = await service.createFromConversations('biz1', true);

      expect(result.updated).toBe(1);
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({
          name: 'Emma',
          email: 'emma@test.com',
          tags: ['new'],
          customFields: { aiNotes: 'Interested in botox' },
        }),
      });
    });

    it('skips conversations without customer', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        { id: 'conv1', customer: null, messages: [] },
      ] as any);

      const result = await service.createFromConversations('biz1', true);

      expect(result.updated).toBe(0);
    });

    it('does not update when no profile data is extracted', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv1',
          customer: {
            id: 'c1',
            name: 'Emma',
            phone: '+123',
            email: 'e@test.com',
            tags: [],
            customFields: {},
          },
          messages: [{ direction: 'INBOUND', content: 'Hi', createdAt: new Date() }],
        },
      ] as any);
      mockExtractor.extract.mockResolvedValue({});

      const result = await service.createFromConversations('biz1', true);

      expect(result.updated).toBe(0);
    });

    it('does not overwrite existing customer name', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv1',
          customer: { id: 'c1', name: 'Existing Name', phone: '+123', tags: [], customFields: {} },
          messages: [{ direction: 'INBOUND', content: 'text', createdAt: new Date() }],
        },
      ] as any);
      mockExtractor.extract.mockResolvedValue({ name: 'AI Name' });

      const result = await service.createFromConversations('biz1', true);

      expect(result.updated).toBe(0);
    });

    it('handles extraction errors gracefully', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv1',
          customer: { id: 'c1', name: '+123', phone: '+123', tags: [], customFields: {} },
          messages: [{ direction: 'INBOUND', content: 'text', createdAt: new Date() }],
        },
      ] as any);
      mockExtractor.extract.mockRejectedValue(new Error('AI error'));

      const result = await service.createFromConversations('biz1', true);

      expect(result.updated).toBe(0);
    });

    it('skips messages when includeMessages is false', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'conv1',
          customer: { id: 'c1', name: 'Emma', phone: '+123' },
        },
      ] as any);

      const result = await service.createFromConversations('biz1', false);

      expect(result.updated).toBe(0);
      expect(mockExtractor.extract).not.toHaveBeenCalled();
    });
  });
});
