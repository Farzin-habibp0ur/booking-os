import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string) {
    return this.prisma.staff.findMany({
      where: { businessId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(businessId: string, data: { name: string; email: string; password: string; role: string }) {
    const existing = await this.prisma.staff.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.staff.create({
      data: { businessId, name: data.name, email: data.email, passwordHash, role: data.role },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
  }

  async update(businessId: string, id: string, data: { name?: string; email?: string; role?: string }) {
    return this.prisma.staff.update({
      where: { id, businessId },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
  }

  async deactivate(businessId: string, id: string) {
    return this.prisma.staff.update({
      where: { id, businessId },
      data: { isActive: false },
    });
  }
}
