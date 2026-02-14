import { Injectable } from '@nestjs/common';
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

  async create(businessId: string, data: { name: string; durationMins: number; price: number; category: string; customFields?: any }) {
    return this.prisma.service.create({ data: { businessId, ...data } });
  }

  async update(businessId: string, id: string, data: any) {
    return this.prisma.service.update({ where: { id, businessId }, data });
  }

  async deactivate(businessId: string, id: string) {
    return this.prisma.service.update({ where: { id, businessId }, data: { isActive: false } });
  }
}
