import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@booking-os/db';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class SavedViewService {
  constructor(private prisma: PrismaService) {}

  async findByPage(businessId: string, staffId: string, page: string) {
    return this.prisma.savedView.findMany({
      where: {
        businessId,
        page,
        OR: [{ staffId }, { isShared: true }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findPinned(businessId: string, staffId: string) {
    return this.prisma.savedView.findMany({
      where: {
        businessId,
        isPinned: true,
        OR: [{ staffId }, { isShared: true }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findDashboard(businessId: string, staffId: string) {
    return this.prisma.savedView.findMany({
      where: {
        businessId,
        isDashboard: true,
        OR: [{ staffId }, { isShared: true }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(
    businessId: string,
    staffId: string,
    data: {
      page: string;
      name: string;
      filters: Record<string, unknown>;
      icon?: string;
      color?: string;
    },
  ) {
    return this.prisma.savedView.create({
      data: {
        businessId,
        staffId,
        page: data.page,
        name: data.name,
        filters: data.filters as Prisma.InputJsonValue,
        icon: data.icon,
        color: data.color,
      },
    });
  }

  async update(
    id: string,
    businessId: string,
    staffId: string,
    role: string,
    data: {
      name?: string;
      filters?: Record<string, unknown>;
      icon?: string;
      color?: string;
      isPinned?: boolean;
      isDashboard?: boolean;
      sortOrder?: number;
    },
  ) {
    const view = await this.prisma.savedView.findFirst({
      where: { id, businessId },
    });
    if (!view) throw new NotFoundException('Saved view not found');
    if (view.staffId !== staffId && role !== 'ADMIN') {
      throw new ForbiddenException('Only the owner or an admin can update this view');
    }
    const { filters, ...rest } = data;
    const updateData: Prisma.SavedViewUpdateInput = { ...rest };
    if (filters !== undefined) {
      updateData.filters = filters as Prisma.InputJsonValue;
    }
    return this.prisma.savedView.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, businessId: string, staffId: string, role: string) {
    const view = await this.prisma.savedView.findFirst({
      where: { id, businessId },
    });
    if (!view) throw new NotFoundException('Saved view not found');
    if (view.staffId !== staffId && role !== 'ADMIN') {
      throw new ForbiddenException('Only the owner or an admin can delete this view');
    }
    return this.prisma.savedView.delete({ where: { id } });
  }

  async share(id: string, businessId: string, isShared: boolean) {
    const view = await this.prisma.savedView.findFirst({
      where: { id, businessId },
    });
    if (!view) throw new NotFoundException('Saved view not found');
    return this.prisma.savedView.update({
      where: { id },
      data: { isShared },
    });
  }
}
