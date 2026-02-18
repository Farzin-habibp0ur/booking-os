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

      const result = await offerService.create('biz1', {
        name: '20% Off Botox',
        maxRedemptions: 50,
      });

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

      await expect(offerService.redeem('biz1', 'off1')).rejects.toThrow('Offer is not active');
    });

    it('throws when offer has expired', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        validUntil: new Date(Date.now() - 86400000),
      } as any);

      await expect(offerService.redeem('biz1', 'off1')).rejects.toThrow('Offer has expired');
    });

    it('throws when offer not found', async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(offerService.redeem('biz1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create with validFrom and serviceIds', () => {
    it('creates offer with validFrom date', async () => {
      prisma.offer.create.mockResolvedValue({
        ...mockOffer,
        validFrom: new Date('2026-03-01'),
      } as any);

      await offerService.create('biz1', {
        name: 'Spring Sale',
        validFrom: '2026-03-01',
      });

      expect(prisma.offer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          validFrom: new Date('2026-03-01'),
        }),
      });
    });

    it('creates offer with specific serviceIds', async () => {
      prisma.offer.create.mockResolvedValue({
        ...mockOffer,
        serviceIds: ['svc1', 'svc2'],
      } as any);

      await offerService.create('biz1', {
        name: 'Service Bundle',
        serviceIds: ['svc1', 'svc2'],
      });

      expect(prisma.offer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceIds: ['svc1', 'svc2'],
        }),
      });
    });

    it('defaults serviceIds to empty array when omitted', async () => {
      prisma.offer.create.mockResolvedValue({ ...mockOffer } as any);

      await offerService.create('biz1', { name: 'Basic Offer' });

      expect(prisma.offer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceIds: [],
        }),
      });
    });

    it('sets validFrom to null when not provided', async () => {
      prisma.offer.create.mockResolvedValue({ ...mockOffer } as any);

      await offerService.create('biz1', { name: 'No Date Offer' });

      expect(prisma.offer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          validFrom: null,
        }),
      });
    });
  });

  describe('update', () => {
    it('updates offer with validFrom', async () => {
      prisma.offer.findFirst.mockResolvedValue({ id: 'off1' } as any);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        validFrom: new Date('2026-04-01'),
      } as any);

      await offerService.update('biz1', 'off1', { validFrom: '2026-04-01' });

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'off1' },
        data: expect.objectContaining({
          validFrom: new Date('2026-04-01'),
        }),
      });
    });

    it('clears validFrom when set to null', async () => {
      prisma.offer.findFirst.mockResolvedValue({ id: 'off1' } as any);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        validFrom: null,
      } as any);

      await offerService.update('biz1', 'off1', { validFrom: null });

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'off1' },
        data: expect.objectContaining({
          validFrom: null,
        }),
      });
    });

    it('updates serviceIds', async () => {
      prisma.offer.findFirst.mockResolvedValue({ id: 'off1' } as any);
      prisma.offer.update.mockResolvedValue({
        ...mockOffer,
        serviceIds: ['svc3'],
      } as any);

      await offerService.update('biz1', 'off1', { serviceIds: ['svc3'] });

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'off1' },
        data: expect.objectContaining({
          serviceIds: ['svc3'],
        }),
      });
    });
  });

  describe('delete', () => {
    it('deletes an existing offer', async () => {
      prisma.offer.findFirst.mockResolvedValue({ id: 'off1' } as any);
      prisma.offer.delete.mockResolvedValue({} as any);

      const result = await offerService.delete('biz1', 'off1');

      expect(result).toEqual({ deleted: true });
    });

    it('throws when offer not found', async () => {
      prisma.offer.findFirst.mockResolvedValue(null);

      await expect(offerService.delete('biz1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Security: Per-Customer Redemption (C-5) ────────────────────────

  describe('per-customer redemption', () => {
    it('creates redemption record when customerId is provided', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        maxRedemptions: 10,
        currentRedemptions: 0,
      } as any);
      prisma.offerRedemption.findFirst.mockResolvedValue(null);
      prisma.offerRedemption.create.mockResolvedValue({} as any);
      prisma.offer.update.mockResolvedValue({ ...mockOffer, currentRedemptions: 1 } as any);

      await offerService.redeem('biz1', 'off1', 'cust1');

      expect(prisma.offerRedemption.findFirst).toHaveBeenCalledWith({
        where: { offerId: 'off1', customerId: 'cust1' },
      });
      expect(prisma.offerRedemption.create).toHaveBeenCalledWith({
        data: { offerId: 'off1', customerId: 'cust1', businessId: 'biz1' },
      });
    });

    it('rejects duplicate redemption by same customer', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        maxRedemptions: 10,
        currentRedemptions: 1,
      } as any);
      prisma.offerRedemption.findFirst.mockResolvedValue({
        id: 'r1',
        offerId: 'off1',
        customerId: 'cust1',
      } as any);

      await expect(offerService.redeem('biz1', 'off1', 'cust1')).rejects.toThrow(
        'Customer has already redeemed this offer',
      );
    });

    it('skips per-customer check when no customerId', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        maxRedemptions: null,
        currentRedemptions: 0,
      } as any);
      prisma.offer.update.mockResolvedValue({ ...mockOffer, currentRedemptions: 1 } as any);

      await offerService.redeem('biz1', 'off1');

      expect(prisma.offerRedemption.findFirst).not.toHaveBeenCalled();
      expect(prisma.offerRedemption.create).not.toHaveBeenCalled();
    });

    it('allows different customers to redeem the same offer', async () => {
      prisma.offer.findFirst.mockResolvedValue({
        ...mockOffer,
        maxRedemptions: 10,
        currentRedemptions: 1,
      } as any);
      prisma.offerRedemption.findFirst.mockResolvedValue(null);
      prisma.offerRedemption.create.mockResolvedValue({} as any);
      prisma.offer.update.mockResolvedValue({ ...mockOffer, currentRedemptions: 2 } as any);

      await offerService.redeem('biz1', 'off1', 'cust2');

      expect(prisma.offerRedemption.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ customerId: 'cust2' }),
      });
    });
  });
});
