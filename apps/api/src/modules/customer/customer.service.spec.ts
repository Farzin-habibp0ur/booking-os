import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', tags: ['vip'] },
      ] as any);

      const result = await service.bulkUpdate('biz1', ['c1'], 'tag', { tag: 'vip' });

      expect(result.updated).toBe(0);
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('removes tag from customers with untag action', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', tags: ['vip', 'new'] },
      ] as any);
      prisma.customer.update.mockResolvedValue({} as any);

      const result = await service.bulkUpdate('biz1', ['c1'], 'untag', { tag: 'vip' });

      expect(result.updated).toBe(1);
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { tags: ['new'] },
      });
    });

    it('skips untag when customer does not have the tag', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', tags: ['other'] },
      ] as any);

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
      await expect(
        service.bulkUpdate('biz1', ['c1'], 'delete' as any, {}),
      ).rejects.toThrow(BadRequestException);
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
      const result = await service.bulkCreate('biz1', [
        { name: 'Emma', phone: '' },
      ]);

      expect(result.errors).toBe(1);
    });

    it('counts errors for create failures', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockRejectedValue(new Error('DB error'));

      const result = await service.bulkCreate('biz1', [
        { name: 'Emma', phone: '+123' },
      ]);

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
          messages: [
            { direction: 'INBOUND', content: 'Hi, I am Emma', createdAt: new Date() },
          ],
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
          customer: { id: 'c1', name: 'Emma', phone: '+123', email: 'e@test.com', tags: [], customFields: {} },
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
