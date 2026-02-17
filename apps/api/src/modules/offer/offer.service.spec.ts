import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OfferService } from './offer.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('OfferService', () => {
  let offerService: OfferService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [OfferService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    offerService = module.get(OfferService);
  });

  describe('create', () => {
    it('creates an offer', async () => {
      prisma.offer.create.mockResolvedValue({ id: 'off1', name: '20% Off Botox' } as any);

      const result = await offerService.create('biz1', { name: '20% Off Botox' });

      expect(result.name).toBe('20% Off Botox');
      expect(prisma.offer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ businessId: 'biz1', name: '20% Off Botox' }),
      });
    });
  });

  describe('findAll', () => {
    it('returns all offers for business', async () => {
      prisma.offer.findMany.mockResolvedValue([{ id: 'off1' }] as any);

      const result = await offerService.findAll('biz1');

      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('returns offer scoped to business', async () => {
      prisma.offer.findFirst.mockResolvedValue({ id: 'off1' } as any);

      const result = await offerService.findById('biz1', 'off1');

      expect(result.id).toBe('off1');
    });

    it('throws if not found', async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(offerService.findById('biz1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes an existing offer', async () => {
      prisma.offer.findFirst.mockResolvedValue({ id: 'off1' } as any);
      prisma.offer.delete.mockResolvedValue({} as any);

      const result = await offerService.delete('biz1', 'off1');

      expect(result).toEqual({ deleted: true });
    });
  });
});
