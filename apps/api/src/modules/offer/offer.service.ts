import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class OfferService {
  constructor(private prisma: PrismaService) {}

  async create(
    businessId: string,
    data: {
      name: string;
      description?: string;
      terms?: string;
      serviceIds?: string[];
      validFrom?: string;
      validUntil?: string;
      maxRedemptions?: number;
    },
  ) {
    return this.prisma.offer.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        terms: data.terms,
        serviceIds: data.serviceIds || [],
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        ...(data.maxRedemptions !== undefined && { maxRedemptions: data.maxRedemptions }),
      },
    });
  }

  async findAll(businessId: string) {
    return this.prisma.offer.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(businessId: string, id: string) {
    const offer = await this.prisma.offer.findFirst({ where: { id, businessId } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async update(businessId: string, id: string, data: any) {
    await this.findById(businessId, id);
    return this.prisma.offer.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.terms !== undefined && { terms: data.terms }),
        ...(data.serviceIds !== undefined && { serviceIds: data.serviceIds }),
        ...(data.validFrom !== undefined && {
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
        }),
        ...(data.validUntil !== undefined && {
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.maxRedemptions !== undefined && { maxRedemptions: data.maxRedemptions }),
      },
    });
  }

  // C-5 fix: Atomically redeem with per-customer tracking via transaction
  async redeem(businessId: string, id: string, customerId?: string) {
    return this.prisma.$transaction(async (tx) => {
      // Lock the offer row to prevent race conditions
      await tx.$queryRaw`SELECT id FROM "offers" WHERE id = ${id} FOR UPDATE`;

      const offer = await tx.offer.findFirst({ where: { id, businessId } });
      if (!offer) throw new NotFoundException('Offer not found');

      if (!offer.isActive) {
        throw new BadRequestException('Offer is not active');
      }
      if (offer.validUntil && offer.validUntil < new Date()) {
        throw new BadRequestException('Offer has expired');
      }
      // Enforce global redemption limit (null maxRedemptions = unlimited)
      if (offer.maxRedemptions !== null && offer.currentRedemptions >= offer.maxRedemptions) {
        throw new BadRequestException('Offer redemption limit reached');
      }

      // C-5: Per-customer duplicate check (each customer can redeem once)
      if (customerId) {
        const existingRedemption = await tx.offerRedemption.findFirst({
          where: { offerId: id, customerId },
        });
        if (existingRedemption) {
          throw new BadRequestException('Customer has already redeemed this offer');
        }
        await tx.offerRedemption.create({
          data: { offerId: id, customerId, businessId },
        });
      }

      return tx.offer.update({
        where: { id },
        data: { currentRedemptions: { increment: 1 } },
      });
    });
  }

  async delete(businessId: string, id: string) {
    await this.findById(businessId, id);
    await this.prisma.offer.delete({ where: { id } });
    return { deleted: true };
  }
}
