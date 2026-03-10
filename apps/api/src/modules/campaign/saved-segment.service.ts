import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SavedSegmentService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string) {
    return this.prisma.savedSegment.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(businessId: string, data: { name: string; filters: any }) {
    return this.prisma.savedSegment.create({
      data: {
        businessId,
        name: data.name,
        filters: data.filters || {},
      },
    });
  }

  async update(businessId: string, id: string, data: { name?: string; filters?: any }) {
    const segment = await this.prisma.savedSegment.findFirst({
      where: { id, businessId },
    });
    if (!segment) throw new NotFoundException('Segment not found');

    return this.prisma.savedSegment.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.filters !== undefined && { filters: data.filters }),
      },
    });
  }

  async delete(businessId: string, id: string) {
    const segment = await this.prisma.savedSegment.findFirst({
      where: { id, businessId },
    });
    if (!segment) throw new NotFoundException('Segment not found');

    await this.prisma.savedSegment.delete({ where: { id } });
    return { deleted: true };
  }
}
