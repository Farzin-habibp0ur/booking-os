import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@booking-os/db';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(private prisma: PrismaService) {}

  // ---- Locations ----

  async findAll(businessId: string) {
    return this.prisma.location.findMany({
      where: { businessId, isActive: true },
      include: {
        resources: { where: { isActive: true } },
        staffLocations: { include: { staff: { select: { id: true, name: true, role: true } } } },
        _count: { select: { bookings: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(businessId: string, id: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, businessId },
      include: {
        resources: { where: { isActive: true } },
        staffLocations: { include: { staff: { select: { id: true, name: true, role: true } } } },
      },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async create(
    businessId: string,
    data: {
      name: string;
      address?: string;
      isBookable?: boolean;
      whatsappConfig?: Record<string, unknown>;
    },
  ) {
    return this.prisma.location.create({
      data: {
        businessId,
        name: data.name,
        address: data.address,
        isBookable: data.isBookable ?? true,
        whatsappConfig: (data.whatsappConfig as Prisma.InputJsonValue) ?? undefined,
      },
      include: {
        resources: true,
        staffLocations: { include: { staff: { select: { id: true, name: true, role: true } } } },
      },
    });
  }

  async update(
    businessId: string,
    id: string,
    data: {
      name?: string;
      address?: string;
      isBookable?: boolean;
      whatsappConfig?: Record<string, unknown>;
    },
  ) {
    await this.findById(businessId, id);
    const updateData: Prisma.LocationUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.isBookable !== undefined && { isBookable: data.isBookable }),
      ...(data.whatsappConfig !== undefined && {
        whatsappConfig: data.whatsappConfig as Prisma.InputJsonValue,
      }),
    };
    return this.prisma.location.update({
      where: { id },
      data: updateData,
      include: {
        resources: true,
        staffLocations: { include: { staff: { select: { id: true, name: true, role: true } } } },
      },
    });
  }

  async softDelete(businessId: string, id: string) {
    await this.findById(businessId, id);
    return this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ---- Resources ----

  async findResources(businessId: string, locationId: string) {
    await this.findById(businessId, locationId);
    return this.prisma.resource.findMany({
      where: { locationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createResource(
    businessId: string,
    locationId: string,
    data: {
      name: string;
      type: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.findById(businessId, locationId);
    return this.prisma.resource.create({
      data: {
        locationId,
        name: data.name,
        type: data.type,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async updateResource(
    businessId: string,
    locationId: string,
    resourceId: string,
    data: {
      name?: string;
      type?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.findById(businessId, locationId);
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, locationId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    const updateData: Prisma.ResourceUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.metadata !== undefined && { metadata: data.metadata as Prisma.InputJsonValue }),
    };
    return this.prisma.resource.update({
      where: { id: resourceId },
      data: updateData,
    });
  }

  async softDeleteResource(businessId: string, locationId: string, resourceId: string) {
    await this.findById(businessId, locationId);
    const resource = await this.prisma.resource.findFirst({
      where: { id: resourceId, locationId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    return this.prisma.resource.update({
      where: { id: resourceId },
      data: { isActive: false },
    });
  }

  // ---- Staff-Location Assignments ----

  async assignStaff(businessId: string, locationId: string, staffId: string) {
    await this.findById(businessId, locationId);

    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) throw new BadRequestException('Staff not found in this business');

    try {
      return await this.prisma.staffLocation.create({
        data: { staffId, locationId },
        include: { staff: { select: { id: true, name: true, role: true } } },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('Staff is already assigned to this location');
      }
      throw error;
    }
  }

  async unassignStaff(businessId: string, locationId: string, staffId: string) {
    await this.findById(businessId, locationId);

    const assignment = await this.prisma.staffLocation.findUnique({
      where: { staffId_locationId: { staffId, locationId } },
    });
    if (!assignment) throw new NotFoundException('Staff is not assigned to this location');

    return this.prisma.staffLocation.delete({
      where: { staffId_locationId: { staffId, locationId } },
    });
  }

  // ---- Utility ----

  async getStaffForLocation(locationId: string) {
    const assignments = await this.prisma.staffLocation.findMany({
      where: { locationId },
      include: { staff: { select: { id: true, name: true, role: true, isActive: true } } },
    });
    return assignments.filter((a) => a.staff.isActive).map((a) => a.staff);
  }

  async findLocationByWhatsappPhoneNumberId(phoneNumberId: string) {
    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
    });
    return locations.find((loc) => {
      const config = loc.whatsappConfig as Record<string, unknown> | null;
      return config?.phoneNumberId === phoneNumberId;
    });
  }
}
