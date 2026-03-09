import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { UpdatePortalProfileDto } from './dto';

@Injectable()
export class PortalService {
  constructor(private prisma: PrismaService) {}

  async getProfile(customerId: string, businessId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const [totalBookings, totalSpent] = await Promise.all([
      this.prisma.booking.count({
        where: { customerId, businessId },
      }),
      this.prisma.booking.aggregate({
        where: { customerId, businessId, status: 'COMPLETED' },
        _sum: { amount: true },
      } as any),
    ]);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      preferences: (customer as any).customFields || {},
      memberSince: customer.createdAt,
      totalBookings,
      totalSpent: (totalSpent as any)._sum?.amount || 0,
    };
  }

  async updateProfile(customerId: string, businessId: string, dto: UpdatePortalProfileDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.notifyWhatsApp !== undefined || dto.notifyEmail !== undefined) {
      const prefs = ((customer as any).customFields as any) || {};
      if (dto.notifyWhatsApp !== undefined) prefs.notifyWhatsApp = dto.notifyWhatsApp;
      if (dto.notifyEmail !== undefined) prefs.notifyEmail = dto.notifyEmail;
      data.customFields = prefs;
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data,
    });
  }

  async getBookings(
    customerId: string,
    businessId: string,
    query: { page?: number; status?: string },
  ) {
    const page = query.page || 1;
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    const where: any = { customerId, businessId };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          service: { select: { name: true, durationMins: true, price: true } },
          staff: { select: { name: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getUpcoming(customerId: string, businessId: string) {
    return this.prisma.booking.findMany({
      where: {
        customerId,
        businessId,
        startTime: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        service: { select: { name: true, durationMins: true, price: true } },
        staff: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    });
  }
}
