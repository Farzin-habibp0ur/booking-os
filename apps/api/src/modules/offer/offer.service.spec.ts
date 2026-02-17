import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OfferService } from './offer.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('OfferService', () => {
  let offerService: OfferService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const mockOffer = {
    id: 'off1',
    businessId: 'biz1',
    name: '20% Off Botox',
    description: null,
    terms: null,
    serviceIds: [],
    validFrom: null,
    validUntil: null,
    isActive: true,
    maxRedemptions: null,
    currentRedemptions: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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

    it('creates an offer with maxRedemptions', async () => {
      prisma.offer.create.mockResolvedValue({ ...mockOffer, maxRedemptions: 50 } as any);

      const result = await offerService.create('biz1', { name: '20% Off Botox', maxRedemptions: 50 });

      expect(prisma.offer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ maxRedemptions: 50 }),
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

  // H9: Offer redemption limit tests
  describe('redeem', () => {
    it('increments currentRedemptions when under limit', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        maxRedemptions: 10,
        currentRedemptions: 5,
      } as any);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        currentRedemptions: 6,
      } as any);

      const result = await offerService.redeem('biz1', 'off1');

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'off1' },
        data: { currentRedemptions: { increment: 1 } },
      });
    });

    it('allows unlimited redemptions when maxRedemptions is null', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        maxRedemptions: null,
        currentRedemptions: 999,
      } as any);
      prisma.offer.update.mockResolvedValue({} as any);

      await offerService.redeem('biz1', 'off1');

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'off1' },
        data: { currentRedemptions: { increment: 1 } },
      });
    });

    it('throws when redemption limit reached', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        maxRedemptions: 10,
        currentRedemptions: 10,
      } as any);

      await expect(offerService.redeem('biz1', 'off1')).rejects.toThrow(
        'Offer redemption limit reached',
      );
    });

    it('throws when offer is not active', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        isActive: false,
      } as any);

      await expect(offerService.redeem('biz1', 'off1')).rejects.toThrow(
        'Offer is not active',
      );
    });

    it('throws when offer has expired', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        validUntil: new Date(Date.now() - 86400000),
      } as any);

      await expect(offerService.redeem('biz1', 'off1')).rejects.toThrow(
        'Offer has expired',
      );
    });

    it('throws when offer not found', async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(offerService.redeem('biz1', 'nope')).rejects.toThrow(NotFoundException);
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
