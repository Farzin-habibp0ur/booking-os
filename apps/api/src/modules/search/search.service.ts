import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(businessId: string, query: string, limit = 5, offset = 0, types?: string[]) {
    if (!query || query.trim().length < 2) {
      return {
        customers: [],
        bookings: [],
        services: [],
        conversations: [],
        totals: { customers: 0, bookings: 0, services: 0, conversations: 0 },
      };
    }

    const q = query.trim().substring(0, 200);
    const safeLim = Math.min(50, Math.max(1, limit));
    const searchAll = !types || types.length === 0;

    const customerWhere = {
      businessId,
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    const bookingWhere = {
      businessId,
      OR: [
        { customer: { name: { contains: q, mode: 'insensitive' as const } } },
        { service: { name: { contains: q, mode: 'insensitive' as const } } },
      ],
    };

    const serviceWhere = {
      businessId,
      name: { contains: q, mode: 'insensitive' as const },
    };

    const conversationWhere = {
      businessId,
      customer: { name: { contains: q, mode: 'insensitive' as const } },
    };

    const [
      customers,
      bookings,
      services,
      conversations,
      customerCount,
      bookingCount,
      serviceCount,
      conversationCount,
    ] = await Promise.all([
      searchAll || types!.includes('customer')
        ? this.prisma.customer.findMany({
            where: customerWhere,
            select: { id: true, name: true, phone: true, email: true },
            take: safeLim,
            skip: offset,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      searchAll || types!.includes('booking')
        ? this.prisma.booking.findMany({
            where: bookingWhere,
            select: {
              id: true,
              startTime: true,
              status: true,
              customer: { select: { name: true } },
              service: { select: { name: true } },
            },
            take: safeLim,
            skip: offset,
            orderBy: { startTime: 'desc' },
          })
        : Promise.resolve([]),
      searchAll || types!.includes('service')
        ? this.prisma.service.findMany({
            where: serviceWhere,
            select: { id: true, name: true, durationMins: true, price: true },
            take: safeLim,
            skip: offset,
            orderBy: { name: 'asc' },
          })
        : Promise.resolve([]),
      searchAll || types!.includes('conversation')
        ? this.prisma.conversation.findMany({
            where: conversationWhere,
            select: {
              id: true,
              customer: { select: { name: true } },
              lastMessageAt: true,
              status: true,
            },
            take: safeLim,
            skip: offset,
            orderBy: { lastMessageAt: 'desc' },
          })
        : Promise.resolve([]),
      searchAll || types!.includes('customer')
        ? this.prisma.customer.count({ where: customerWhere })
        : Promise.resolve(0),
      searchAll || types!.includes('booking')
        ? this.prisma.booking.count({ where: bookingWhere })
        : Promise.resolve(0),
      searchAll || types!.includes('service')
        ? this.prisma.service.count({ where: serviceWhere })
        : Promise.resolve(0),
      searchAll || types!.includes('conversation')
        ? this.prisma.conversation.count({ where: conversationWhere })
        : Promise.resolve(0),
    ]);

    return {
      customers,
      bookings,
      services,
      conversations,
      totals: {
        customers: customerCount,
        bookings: bookingCount,
        services: serviceCount,
        conversations: conversationCount,
      },
    };
  }
}
