import { Test } from '@nestjs/testing';
import { ServiceService } from './service.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ServiceService', () => {
  let serviceService: ServiceService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [ServiceService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    serviceService = module.get(ServiceService);
  });

  describe('findAll', () => {
    it('returns services ordered by category', async () => {
      const services = [
        { id: 's1', category: 'Hair' },
        { id: 's2', category: 'Nails' },
      ];
      prisma.service.findMany.mockResolvedValue(services as any);

      const result = await serviceService.findAll('biz1');

      expect(result).toEqual(services);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { category: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('creates service with businessId', async () => {
      const data = { name: 'Haircut', durationMins: 30, price: 50 };
      prisma.service.create.mockResolvedValue({ id: 's1', ...data } as any);

      const result = await serviceService.create('biz1', data);

      expect(result.id).toBe('s1');
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', ...data },
      });
    });
  });

  describe('update', () => {
    it('updates service scoped to business', async () => {
      prisma.service.update.mockResolvedValue({ id: 's1', name: 'Updated' } as any);

      const result = await serviceService.update('biz1', 's1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 's1', businessId: 'biz1' },
        data: { name: 'Updated' },
      });
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false', async () => {
      prisma.service.update.mockResolvedValue({ id: 's1', isActive: false } as any);

      const result = await serviceService.deactivate('biz1', 's1');

      expect(result.isActive).toBe(false);
      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 's1', businessId: 'biz1' },
        data: { isActive: false },
      });
    });
  });

  describe('ServiceKind', () => {
    it('creates service with kind CONSULT', async () => {
      const data = { name: 'Initial Consult', durationMins: 20, price: 0, kind: 'CONSULT' };
      prisma.service.create.mockResolvedValue({ id: 's1', ...data } as any);

      const result = await serviceService.create('biz1', data);

      expect(result.id).toBe('s1');
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', ...data },
      });
    });

    it('creates service with kind TREATMENT', async () => {
      const data = { name: 'Botox', durationMins: 30, price: 350, kind: 'TREATMENT' };
      prisma.service.create.mockResolvedValue({ id: 's2', ...data } as any);

      const result = await serviceService.create('biz1', data);

      expect(result.id).toBe('s2');
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', ...data },
      });
    });

    it('updates service kind', async () => {
      prisma.service.update.mockResolvedValue({ id: 's1', kind: 'TREATMENT' } as any);

      const result = await serviceService.update('biz1', 's1', { kind: 'TREATMENT' });

      expect(result.kind).toBe('TREATMENT');
      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: 's1', businessId: 'biz1' },
        data: { kind: 'TREATMENT' },
      });
    });

    it('defaults kind to OTHER when not specified', async () => {
      const data = { name: 'Misc Service', durationMins: 15, price: 50 };
      prisma.service.create.mockResolvedValue({ id: 's3', kind: 'OTHER', ...data } as any);

      const result = await serviceService.create('biz1', data);

      // The DB default handles this, so we just verify the call passes through without kind
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: { businessId: 'biz1', ...data },
      });
      expect(result.kind).toBe('OTHER');
    });
  });
});
