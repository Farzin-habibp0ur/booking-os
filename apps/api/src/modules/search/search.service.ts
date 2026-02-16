import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(businessId: string, query: string, limit = 5) {
    if (!query || query.trim().length < 2) {
      return { customers: [], bookings: [], services: [], conversations: [] };
    }

    const q = query.trim();

    const [customers, bookings, services, conversations] = await Promise.all([
      this.prisma.customer.findMany({
        where: {
          businessId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.findMany({
        where: {
          businessId,
          OR: [
            { customer: { name: { contains: q, mode: 'insensitive' } } },
            { service: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          startTime: true,
          status: true,
          customer: { select: { name: true } },
          service: { select: { name: true } },
        },
        take: limit,
        orderBy: { startTime: 'desc' },
      }),
      this.prisma.service.findMany({
        where: {
          businessId,
          name: { contains: q, mode: 'insensitive' },
        },
        select: { id: true, name: true, durationMins: true, price: true },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.conversation.findMany({
        where: {
          businessId,
          customer: { name: { contains: q, mode: 'insensitive' } },
        },
        select: {
          id: true,
          customer: { select: { name: true } },
          lastMessageAt: true,
          status: true,
        },
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
      }),
    ]);

    return { customers, bookings, services, conversations };
  }
}
