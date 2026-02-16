import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from '../../common/prisma.service';
import { ProfileExtractor } from '../ai/profile-extractor';
import { createMockPrisma } from '../../test/mocks';

describe('CustomerService', () => {
  let customerService: CustomerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let profileExtractor: { extract: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    profileExtractor = { extract: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfileExtractor, useValue: profileExtractor },
      ],
    }).compile();

    customerService = module.get(CustomerService);
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      const customers = [{ id: 'c1' }, { id: 'c2' }];
      prisma.customer.findMany.mockResolvedValue(customers as any);
      prisma.customer.count.mockResolvedValue(2);

      const result = await customerService.findAll('biz1', {});

      expect(result).toEqual({
        data: customers,
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('applies search filter on name/phone/email', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.customer.count.mockResolvedValue(0);

      await customerService.findAll('biz1', { search: 'alice' });

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            OR: [
              { name: { contains: 'alice', mode: 'insensitive' } },
              { phone: { contains: 'alice' } },
              { email: { contains: 'alice', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns customer scoped to business', async () => {
      const customer = { id: 'c1', businessId: 'biz1', name: 'Alice' };
      prisma.customer.findFirst.mockResolvedValue(customer as any);

      const result = await customerService.findById('biz1', 'c1');

      expect(result).toEqual(customer);
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', businessId: 'biz1' },
      });
    });
  });

  describe('findOrCreateByPhone', () => {
    it('returns existing customer', async () => {
      const existing = { id: 'c1', phone: '+1234' };
      prisma.customer.findFirst.mockResolvedValue(existing as any);

      const result = await customerService.findOrCreateByPhone('biz1', '+1234');

      expect(result).toEqual(existing);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('creates new customer if not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      const created = { id: 'c2', phone: '+5678', name: 'Bob' };
      prisma.customer.create.mockResolvedValue(created as any);

      const result = await customerService.findOrCreateByPhone('biz1', '+5678', 'Bob');

      expect(result).toEqual(created);
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', phone: '+5678', name: 'Bob' },
      });
    });

    it('uses phone as name when name not provided', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'c3' } as any);

      await customerService.findOrCreateByPhone('biz1', '+5678');

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', phone: '+5678', name: '+5678' },
      });
    });
  });

  describe('create', () => {
    it('creates customer with business scope', async () => {
      const data = { name: 'Alice', phone: '+1234', email: 'alice@test.com' };
      prisma.customer.create.mockResolvedValue({ id: 'c1', ...data } as any);

      const result = await customerService.create('biz1', data);

      expect(result.id).toBe('c1');
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', ...data },
      });
    });
  });

  describe('update', () => {
    it('updates customer fields', async () => {
      prisma.customer.update.mockResolvedValue({ id: 'c1', name: 'Updated' } as any);

      const result = await customerService.update('biz1', 'c1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1', businessId: 'biz1' },
        data: { name: 'Updated' },
      });
    });
  });

  describe('bulkUpdate', () => {
    it('adds tag to customers that do not have it', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', tags: ['existing'] },
        { id: 'c2', tags: [] },
        { id: 'c3', tags: ['existing', 'vip'] },
      ] as any);
      prisma.customer.update.mockResolvedValue({} as any);

      const result = await customerService.bulkUpdate('biz1', ['c1', 'c2', 'c3'], 'tag', { tag: 'vip' });

      expect(result.updated).toBe(2);
      expect(prisma.customer.update).toHaveBeenCalledTimes(2);
    });

    it('removes tag from customers that have it', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', tags: ['vip', 'premium'] },
        { id: 'c2', tags: [] },
      ] as any);
      prisma.customer.update.mockResolvedValue({} as any);

      const result = await customerService.bulkUpdate('biz1', ['c1', 'c2'], 'untag', { tag: 'vip' });

      expect(result.updated).toBe(1);
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { tags: ['premium'] },
      });
    });

    it('throws if no IDs provided', async () => {
      await expect(
        customerService.bulkUpdate('biz1', [], 'tag', { tag: 'vip' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if tag is missing', async () => {
      await expect(
        customerService.bulkUpdate('biz1', ['c1'], 'tag', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkCreate', () => {
    it('counts created customers', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({} as any);

      const result = await customerService.bulkCreate('biz1', [
        { name: 'A', phone: '+1' },
        { name: 'B', phone: '+2' },
      ]);

      expect(result).toEqual({ created: 2, skipped: 0, errors: 0 });
    });

    it('skips duplicates', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'existing' } as any);

      const result = await customerService.bulkCreate('biz1', [{ name: 'A', phone: '+1' }]);

      expect(result).toEqual({ created: 0, skipped: 1, errors: 0 });
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('errors on missing phone', async () => {
      const result = await customerService.bulkCreate('biz1', [{ name: 'A', phone: '' }]);

      expect(result).toEqual({ created: 0, skipped: 0, errors: 1 });
    });
  });
});
