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

  async getAiSettings(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) return null;
    const defaults = {
      enabled: false,
      autoReplySuggestions: true,
      bookingAssistant: true,
      personality: 'friendly and professional',
    };
    const raw = business.aiSettings || {};
    return { ...defaults, ...(typeof raw === 'object' ? raw : {}) };
  }

  async updateAiSettings(id: string, settings: { enabled?: boolean; autoReplySuggestions?: boolean; bookingAssistant?: boolean; personality?: string }) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) return null;
    const current = (typeof business.aiSettings === 'object' && business.aiSettings) ? business.aiSettings as any : {};
    const merged = { ...current, ...settings };
    return this.prisma.business.update({
      where: { id },
      data: { aiSettings: merged },
    });
  }
}
