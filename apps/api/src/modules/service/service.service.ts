import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ServiceService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string) {
    return this.prisma.service.findMany({
      where: { businessId },
      orderBy: { category: 'asc' },
    });
  }

  private validateDeposit(data: any) {
    if (
      data.depositRequired &&
      (data.depositAmount === undefined || data.depositAmount === null || data.depositAmount <= 0)
    ) {
      throw new BadRequestException('Deposit amount is required when deposit is enabled');
    }
    if (data.depositAmount !== undefined && data.depositAmount !== null) {
      if (data.price !== undefined && data.depositAmount > data.price) {
        throw new BadRequestException('Deposit amount cannot exceed service price');
      }
    }
  }

  async create(
    businessId: string,
    data: {
      name: string;
      durationMins: number;
      price: number;
      category?: string;
      description?: string;
      depositRequired?: boolean;
      depositAmount?: number;
      customFields?: any;
    },
  ) {
    this.validateDeposit(data);
    return this.prisma.service.create({ data: { businessId, ...data } });
  }

  async update(businessId: string, id: string, data: any) {
    if (data.depositRequired !== undefined || data.depositAmount !== undefined) {
      const existing = await this.prisma.service.findUniqueOrThrow({ where: { id, businessId } });
      const merged = { ...existing, ...data };
      this.validateDeposit(merged);
    }
    return this.prisma.service.update({ where: { id, businessId }, data });
  }

  async deactivate(businessId: string, id: string) {
    return this.prisma.service.update({ where: { id, businessId }, data: { isActive: false } });
  }
}
