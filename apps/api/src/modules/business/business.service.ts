import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { VerticalPackService } from '../vertical-pack/vertical-pack.service';

@Injectable()
export class BusinessService {
  constructor(
    private prisma: PrismaService,
    private verticalPackService: VerticalPackService,
  ) {}

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

  async getPolicySettings(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) return null;
    const defaults = {
      cancellationWindowHours: 24,
      rescheduleWindowHours: 24,
      cancellationPolicyText: '',
      reschedulePolicyText: '',
      policyEnabled: false,
    };
    const raw = business.policySettings || {};
    return { ...defaults, ...(typeof raw === 'object' ? raw : {}) };
  }

  async updatePolicySettings(
    id: string,
    settings: {
      cancellationWindowHours?: number;
      rescheduleWindowHours?: number;
      cancellationPolicyText?: string;
      reschedulePolicyText?: string;
      policyEnabled?: boolean;
    },
  ) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) return null;
    const current =
      typeof business.policySettings === 'object' && business.policySettings
        ? (business.policySettings as any)
        : {};
    const merged = { ...current, ...settings };
    return this.prisma.business.update({
      where: { id },
      data: { policySettings: merged },
    });
  }

  async installPack(businessId: string, packName: string) {
    let pack;
    try {
      pack = this.verticalPackService.getPack(packName);
    } catch {
      throw new BadRequestException(`Unknown pack: ${packName}`);
    }

    // Set verticalPack on business
    await this.prisma.business.update({
      where: { id: businessId },
      data: { verticalPack: packName },
    });

    // Bulk-create templates (skip if any already exist for this business)
    const existingTemplates = await this.prisma.messageTemplate.findMany({
      where: { businessId },
      select: { name: true },
    });
    const existingTemplateNames = new Set(existingTemplates.map((t) => t.name));
    const newTemplates = (pack.defaultTemplates || []).filter(
      (t) => !existingTemplateNames.has(t.name),
    );
    if (newTemplates.length > 0) {
      await this.prisma.messageTemplate.createMany({
        data: newTemplates.map((t) => ({
          businessId,
          name: t.name,
          category: t.category,
          body: t.body,
          variables: t.variables,
        })),
      });
    }

    // Bulk-create services (skip if any already exist for this business)
    const existingServices = await this.prisma.service.findMany({
      where: { businessId },
      select: { name: true },
    });
    const existingServiceNames = new Set(existingServices.map((s) => s.name));
    const newServices = (pack.defaultServices || []).filter(
      (s) => !existingServiceNames.has(s.name),
    );
    if (newServices.length > 0) {
      await this.prisma.service.createMany({
        data: newServices.map((s) => ({
          businessId,
          name: s.name,
          durationMins: s.durationMins,
          price: s.price,
          category: s.category,
          kind: s.kind,
          customFields: s.depositRequired
            ? { depositRequired: true, depositAmount: s.depositAmount }
            : {},
        })),
      });
    }

    // Set notification settings
    if (pack.defaultNotificationSettings) {
      await this.prisma.business.update({
        where: { id: businessId },
        data: { notificationSettings: pack.defaultNotificationSettings },
      });
    }

    // Merge packConfig + requiredProfileFields
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    const currentConfig =
      typeof business?.packConfig === 'object' && business.packConfig
        ? (business.packConfig as Record<string, unknown>)
        : {};
    const mergedConfig = {
      ...currentConfig,
      ...(pack.defaultPackConfig || {}),
      ...(pack.defaultRequiredProfileFields
        ? { requiredProfileFields: pack.defaultRequiredProfileFields }
        : {}),
    };
    const updatedBusiness = await this.prisma.business.update({
      where: { id: businessId },
      data: { packConfig: mergedConfig },
    });

    // Return summary
    const totalTemplates = await this.prisma.messageTemplate.count({ where: { businessId } });
    const totalServices = await this.prisma.service.count({ where: { businessId } });

    return {
      business: updatedBusiness,
      installed: {
        templates: totalTemplates,
        services: totalServices,
        notificationSettings: !!pack.defaultNotificationSettings,
        packConfig: mergedConfig,
      },
    };
  }

  async createTestBooking(businessId: string) {
    const service = await this.prisma.service.findFirst({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!service) {
      throw new BadRequestException('No active services found. Create at least one service first.');
    }

    const staff = await this.prisma.staff.findFirst({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });

    if (!staff) {
      throw new BadRequestException('No staff members found. Add at least one staff member first.');
    }

    // Find or create test customer
    let customer = await this.prisma.customer.findFirst({
      where: { businessId, email: 'test@example.com' },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          businessId,
          name: 'Test Patient',
          email: 'test@example.com',
          phone: '+10000000000',
        },
      });
    }

    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 2);
    startTime.setHours(10, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + (service.durationMins || 30));

    const booking = await this.prisma.booking.create({
      data: {
        businessId,
        serviceId: service.id,
        staffId: staff.id,
        customerId: customer.id,
        startTime,
        endTime,
        status: 'CONFIRMED',
      },
      include: {
        service: true,
        customer: true,
        staff: true,
      },
    });

    return booking;
  }
}
