import { Injectable, NotFoundException } from '@nestjs/common';
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
      },
    });
  }

  async delete(businessId: string, id: string) {
    await this.findById(businessId, id);
    await this.prisma.offer.delete({ where: { id } });
    return { deleted: true };
  }
}
