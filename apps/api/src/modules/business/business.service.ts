import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.business.findUnique({ where: { id } });
  }

  async update(
    id: string,
    data: {
      name?: string;
      phone?: string;
      timezone?: string;
      verticalPack?: string;
      packConfig?: any;
    },
  ) {
    // Merge packConfig with existing data instead of replacing
    if (data.packConfig) {
      const business = await this.prisma.business.findUnique({ where: { id } });
      const currentConfig =
        typeof business?.packConfig === 'object' && business.packConfig
          ? (business.packConfig as any)
          : {};
      data.packConfig = { ...currentConfig, ...data.packConfig };
    }
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

  async updateAiSettings(
    id: string,
    settings: {
      enabled?: boolean;
      autoReplySuggestions?: boolean;
      bookingAssistant?: boolean;
      personality?: string;
    },
  ) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) return null;
    const current =
      typeof business.aiSettings === 'object' && business.aiSettings
        ? (business.aiSettings as any)
        : {};
    const merged = { ...current, ...settings };
    return this.prisma.business.update({
      where: { id },
      data: { aiSettings: merged },
    });
  }

  async getNotificationSettings(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) return null;
    const defaults = {
      channels: 'both',
      followUpDelayHours: 2,
      consultFollowUpDays: 3,
      treatmentCheckInHours: 24,
    };
    const raw = business.notificationSettings || {};
    return { ...defaults, ...(typeof raw === 'object' ? raw : {}) };
  }

  async updateNotificationSettings(
    id: string,
    settings: { channels?: string; followUpDelayHours?: number; consultFollowUpDays?: number; treatmentCheckInHours?: number },
  ) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) return null;
    const current =
      typeof business.notificationSettings === 'object' && business.notificationSettings
        ? (business.notificationSettings as any)
        : {};
    const merged = { ...current, ...settings };
    return this.prisma.business.update({
      where: { id },
      data: { notificationSettings: merged },
    });
  }
}
