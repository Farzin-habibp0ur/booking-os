import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.business.findUnique({ where: { id } });
  }

  async update(id: string, data: { name?: string; phone?: string; timezone?: string; verticalPack?: string; packConfig?: any }) {
    return this.prisma.business.update({ where: { id }, data });
  }
}
