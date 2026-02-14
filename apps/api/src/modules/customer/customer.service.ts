import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, query: { search?: string; page?: number; pageSize?: number }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: any = { businessId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(businessId: string, id: string) {
    return this.prisma.customer.findFirst({ where: { id, businessId } });
  }

  async findOrCreateByPhone(businessId: string, phone: string, name?: string) {
    let customer = await this.prisma.customer.findFirst({ where: { businessId, phone } });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { businessId, phone, name: name || phone },
      });
    }
    return customer;
  }

  async create(businessId: string, data: { name: string; phone: string; email?: string; tags?: string[]; customFields?: any }) {
    return this.prisma.customer.create({ data: { businessId, ...data } });
  }

  async update(businessId: string, id: string, data: { name?: string; phone?: string; email?: string; tags?: string[]; customFields?: any }) {
    return this.prisma.customer.update({ where: { id, businessId }, data });
  }

  async getBookings(businessId: string, customerId: string) {
    return this.prisma.booking.findMany({
      where: { businessId, customerId },
      include: { service: true, staff: true },
      orderBy: { startTime: 'desc' },
    });
  }
}
