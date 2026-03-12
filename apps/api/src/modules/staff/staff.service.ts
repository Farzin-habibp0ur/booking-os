import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@booking-os/db';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private emailService: EmailService,
    private config: ConfigService,
  ) {}

  private getWebUrl(): string {
    return this.config.get<string>('WEB_URL') || 'http://localhost:3000';
  }

  private static readonly SAFE_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
  } as const;

  private static readonly VALID_SORT_FIELDS = ['name', 'email', 'role', 'createdAt'];

  async findAll(businessId: string, query?: { sortBy?: string; sortOrder?: string }) {
    let orderBy: any = { createdAt: 'asc' };
    if (query?.sortBy && StaffService.VALID_SORT_FIELDS.includes(query.sortBy)) {
      const dir = query.sortOrder === 'asc' ? 'asc' : 'desc';
      orderBy = { [query.sortBy]: dir };
    }
    const staff = await this.prisma.staff.findMany({
      where: { businessId },
      select: { ...StaffService.SAFE_SELECT, passwordHash: true },
      orderBy,
    });
    return staff.map(({ passwordHash, ...s }) => ({
      ...s,
      invitePending: !passwordHash && s.isActive,
    }));
  }

  async create(
    businessId: string,
    data: { name: string; email: string; password: string; role: string },
  ) {
    const existing = await this.prisma.staff.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.staff.create({
      data: { businessId, name: data.name, email: data.email, passwordHash, role: data.role },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
  }

  async update(
    businessId: string,
    id: string,
    data: { name?: string; email?: string; role?: string },
  ) {
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
      select: StaffService.SAFE_SELECT,
    });
  }

  async inviteStaff(businessId: string, data: { email: string; name: string; role?: string }) {
    const existing = await this.prisma.staff.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    // Create staff without password
    const staff = await this.prisma.staff.create({
      data: {
        businessId,
        name: data.name,
        email: data.email,
        role: data.role || 'AGENT',
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    // Create invitation token (48 hours)
    const token = await this.tokenService.createToken(
      'STAFF_INVITE',
      data.email,
      businessId,
      staff.id,
      48,
    );

    const inviteUrl = `${this.getWebUrl()}/accept-invite?token=${token}`;
    await this.emailService.sendStaffInvitation(data.email, {
      name: data.name,
      businessName: business.name,
      inviteUrl,
    });

    return { ...staff, invitePending: true };
  }

  async resendInvite(businessId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
      include: { business: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.passwordHash) throw new ConflictException('Staff has already set their password');

    // Revoke old tokens and create new one
    await this.tokenService.revokeTokens(staff.email, 'STAFF_INVITE');
    const token = await this.tokenService.createToken(
      'STAFF_INVITE',
      staff.email,
      businessId,
      staffId,
      48,
    );

    const inviteUrl = `${this.getWebUrl()}/accept-invite?token=${token}`;
    await this.emailService.sendStaffInvitation(staff.email, {
      name: staff.name,
      businessName: staff.business.name,
      inviteUrl,
    });

    return { ok: true };
  }

  async updatePreferences(staffId: string, data: Record<string, unknown>) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { preferences: true },
    });
    const existing = (staff?.preferences as Record<string, unknown>) || {};
    const merged = { ...existing, ...data };
    return this.prisma.staff.update({
      where: { id: staffId },
      data: { preferences: merged as Prisma.InputJsonValue },
      select: { id: true, preferences: true },
    });
  }

  async getServicePricing(businessId: string, staffId: string) {
    // Verify staff belongs to this business
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    // Get all active services for this business
    const services = await this.prisma.service.findMany({
      where: { businessId, isActive: true },
      orderBy: { category: 'asc' },
    });

    // Get existing staff price overrides
    const overrides = await this.prisma.staffServicePrice.findMany({
      where: { staffId, businessId },
    });

    const overrideMap = new Map(overrides.map((o) => [o.serviceId, o.price]));

    return services.map((service) => ({
      serviceId: service.id,
      serviceName: service.name,
      category: service.category,
      basePrice: service.price,
      overridePrice: overrideMap.get(service.id) ?? null,
    }));
  }

  async setServicePricing(
    businessId: string,
    staffId: string,
    overrides: Array<{ serviceId: string; price: number | null }>,
  ) {
    // Verify staff belongs to this business
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    // Process each override in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const override of overrides) {
        if (override.price === null || override.price === undefined) {
          // Remove the override
          await tx.staffServicePrice.deleteMany({
            where: { staffId, serviceId: override.serviceId, businessId },
          });
        } else {
          // Upsert the override
          await tx.staffServicePrice.upsert({
            where: {
              staffId_serviceId: { staffId, serviceId: override.serviceId },
            },
            create: {
              staffId,
              serviceId: override.serviceId,
              businessId,
              price: override.price,
            },
            update: {
              price: override.price,
            },
          });
        }
      }
    });

    // Return the updated pricing
    return this.getServicePricing(businessId, staffId);
  }

  async assignServices(businessId: string, staffId: string, serviceIds: string[]) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    await this.prisma.$transaction(async (tx) => {
      // Remove services not in the new list (but preserve price overrides for kept services)
      await tx.staffServicePrice.deleteMany({
        where: { staffId, businessId, serviceId: { notIn: serviceIds } },
      });

      // Upsert records for each assigned service (price=null means use default)
      for (const serviceId of serviceIds) {
        await tx.staffServicePrice.upsert({
          where: { staffId_serviceId: { staffId, serviceId } },
          create: { staffId, serviceId, businessId },
          update: {}, // don't change existing price
        });
      }
    });

    return this.getServicePricing(businessId, staffId);
  }

  async getAssignedServices(businessId: string, staffId: string) {
    return this.prisma.staffServicePrice.findMany({
      where: { staffId, businessId },
      select: { serviceId: true, price: true },
    });
  }

  async getStaffPriceForService(staffId: string, serviceId: string): Promise<number | null> {
    const override = await this.prisma.staffServicePrice.findUnique({
      where: {
        staffId_serviceId: { staffId, serviceId },
      },
    });
    return override?.price ?? null;
  }

  async revokeInvite(businessId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    await this.tokenService.revokeTokens(staff.email, 'STAFF_INVITE');
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    return { ok: true };
  }

  async getCertifications(businessId: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.prisma.staffCertification.findMany({
      where: { staffId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addCertification(
    businessId: string,
    staffId: string,
    data: {
      name: string;
      issuedBy?: string;
      issuedDate?: string;
      expiryDate?: string;
      documentUrl?: string;
    },
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.prisma.staffCertification.create({
      data: {
        staffId,
        name: data.name,
        issuedBy: data.issuedBy,
        issuedDate: data.issuedDate ? new Date(data.issuedDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        documentUrl: data.documentUrl,
      },
    });
  }

  async removeCertification(businessId: string, staffId: string, certId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const cert = await this.prisma.staffCertification.findFirst({
      where: { id: certId, staffId },
    });
    if (!cert) throw new NotFoundException('Certification not found');

    return this.prisma.staffCertification.delete({ where: { id: certId } });
  }
}
