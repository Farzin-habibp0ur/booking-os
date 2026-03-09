import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { TestimonialsService } from './testimonials.service';
import { PrismaService } from '../../common/prisma.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

describe('TestimonialsService', () => {
  let service: TestimonialsService;
  let prisma: any;
  let queue: any;

  beforeEach(async () => {
    prisma = {
      testimonial: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      customer: { findFirst: jest.fn() },
      business: { findUnique: jest.fn() },
    };
    queue = { add: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestimonialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: queue },
      ],
    }).compile();

    service = module.get(TestimonialsService);
  });

  describe('create', () => {
    it('creates a testimonial with MANUAL source', async () => {
      const dto = { name: 'Alice', content: 'Great service!' };
      prisma.testimonial.create.mockResolvedValue({
        id: 't1',
        ...dto,
        source: 'MANUAL',
        status: 'PENDING',
      });

      const result = await service.create('b1', dto);

      expect(prisma.testimonial.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'b1',
          name: 'Alice',
          content: 'Great service!',
          source: 'MANUAL',
          status: 'PENDING',
        }),
      });
      expect(result.source).toBe('MANUAL');
    });

    it('creates with optional fields', async () => {
      const dto = { name: 'Bob', content: 'Excellent!', rating: 5, role: 'CEO', company: 'Acme' };
      prisma.testimonial.create.mockResolvedValue({ id: 't2', ...dto });

      await service.create('b1', dto);

      expect(prisma.testimonial.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          rating: 5,
          role: 'CEO',
          company: 'Acme',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      prisma.testimonial.findMany.mockResolvedValue([{ id: 't1' }]);
      prisma.testimonial.count.mockResolvedValue(1);

      const result = await service.findAll('b1', {});

      expect(result).toEqual({ data: [{ id: 't1' }], total: 1, page: 1, pageSize: 20 });
    });

    it('filters by status', async () => {
      prisma.testimonial.findMany.mockResolvedValue([]);
      prisma.testimonial.count.mockResolvedValue(0);

      await service.findAll('b1', { status: 'APPROVED' });

      expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'b1', status: 'APPROVED' },
        }),
      );
    });

    it('respects pagination params', async () => {
      prisma.testimonial.findMany.mockResolvedValue([]);
      prisma.testimonial.count.mockResolvedValue(0);

      const result = await service.findAll('b1', { page: 2, pageSize: 10 });

      expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });

  describe('findOne', () => {
    it('returns a testimonial', async () => {
      prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', businessId: 'b1' });

      const result = await service.findOne('b1', 't1');

      expect(result.id).toBe('t1');
    });

    it('throws NotFoundException if not found', async () => {
      prisma.testimonial.findFirst.mockResolvedValue(null);

      await expect(service.findOne('b1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('sets status to APPROVED', async () => {
      prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', businessId: 'b1' });
      prisma.testimonial.update.mockResolvedValue({ id: 't1', status: 'APPROVED' });

      const result = await service.approve('b1', 't1');

      expect(prisma.testimonial.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'APPROVED' },
      });
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('reject', () => {
    it('sets status to REJECTED', async () => {
      prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', businessId: 'b1' });
      prisma.testimonial.update.mockResolvedValue({ id: 't1', status: 'REJECTED' });

      const result = await service.reject('b1', 't1');

      expect(prisma.testimonial.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'REJECTED' },
      });
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('feature', () => {
    it('sets status to FEATURED when under max', async () => {
      prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', businessId: 'b1' });
      prisma.testimonial.count.mockResolvedValue(3);
      prisma.testimonial.update.mockResolvedValue({ id: 't1', status: 'FEATURED' });

      const result = await service.feature('b1', 't1');

      expect(result.status).toBe('FEATURED');
    });

    it('auto-demotes oldest featured when at max 6', async () => {
      prisma.testimonial.findFirst
        .mockResolvedValueOnce({ id: 't7', businessId: 'b1' }) // findOne
        .mockResolvedValueOnce({ id: 't-oldest', businessId: 'b1' }); // oldest featured
      prisma.testimonial.count.mockResolvedValue(6);
      prisma.testimonial.update
        .mockResolvedValueOnce({ id: 't-oldest', status: 'APPROVED' }) // demote
        .mockResolvedValueOnce({ id: 't7', status: 'FEATURED' }); // promote

      const result = await service.feature('b1', 't7');

      expect(prisma.testimonial.update).toHaveBeenCalledWith({
        where: { id: 't-oldest' },
        data: { status: 'APPROVED' },
      });
      expect(result.status).toBe('FEATURED');
    });
  });

  describe('delete', () => {
    it('deletes a testimonial', async () => {
      prisma.testimonial.findFirst.mockResolvedValue({ id: 't1', businessId: 'b1' });
      prisma.testimonial.delete.mockResolvedValue({ id: 't1' });

      await service.delete('b1', 't1');

      expect(prisma.testimonial.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });

    it('throws NotFoundException for non-existent testimonial', async () => {
      prisma.testimonial.findFirst.mockResolvedValue(null);

      await expect(service.delete('b1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendRequest', () => {
    it('creates a REQUESTED testimonial and enqueues email', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        name: 'Alice',
        email: 'alice@example.com',
      });
      prisma.business.findUnique.mockResolvedValue({ id: 'b1', name: 'Glow Clinic' });
      prisma.testimonial.create.mockResolvedValue({
        id: 't1',
        source: 'REQUESTED',
        status: 'PENDING',
        requestedAt: new Date(),
      });

      const result = await service.sendRequest('b1', 'c1');

      expect(prisma.testimonial.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'REQUESTED',
          customerId: 'c1',
          name: 'Alice',
        }),
      });
      expect(queue.add).toHaveBeenCalledWith(
        'testimonial-request',
        expect.objectContaining({
          to: 'alice@example.com',
          subject: expect.stringContaining('Glow Clinic'),
        }),
      );
      expect(result.source).toBe('REQUESTED');
    });

    it('throws NotFoundException for invalid customer', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.sendRequest('b1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('creates testimonial even without email', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'c2', name: 'Bob', email: null });
      prisma.business.findUnique.mockResolvedValue({ id: 'b1', name: 'Clinic' });
      prisma.testimonial.create.mockResolvedValue({ id: 't2', source: 'REQUESTED' });

      await service.sendRequest('b1', 'c2');

      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('findPublic', () => {
    it('returns APPROVED and FEATURED testimonials for slug', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'b1', slug: 'glow' });
      prisma.testimonial.findMany.mockResolvedValue([
        { id: 't1', status: 'FEATURED', rating: 5 },
        { id: 't2', status: 'APPROVED', rating: 4 },
      ]);

      const result = await service.findPublic('glow');

      expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'b1',
            status: { in: ['APPROVED', 'FEATURED'] },
          },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('throws NotFoundException for invalid slug', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.findPublic('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
