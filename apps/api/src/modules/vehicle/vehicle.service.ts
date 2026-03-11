import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto, ListVehiclesDto } from './dto';

@Injectable()
export class VehicleService {
  constructor(private prisma: PrismaService) {}

  private async assertDealershipVertical(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (biz?.verticalPack !== 'dealership') {
      throw new ForbiddenException('Vehicle inventory is only available for dealership businesses');
    }
  }

  private async generateStockNumber(businessId: string): Promise<string> {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true },
    });
    const prefix = (biz?.name || 'VEH')
      .replace(/[^A-Z0-9]/gi, '')
      .substring(0, 3)
      .toUpperCase();

    const latest = await this.prisma.vehicle.findFirst({
      where: { businessId, stockNumber: { startsWith: `${prefix}-` } },
      orderBy: { stockNumber: 'desc' },
      select: { stockNumber: true },
    });

    let seq = 1;
    if (latest) {
      const lastSeq = parseInt(latest.stockNumber.replace(`${prefix}-`, ''), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}-${String(seq).padStart(5, '0')}`;
  }

  async create(businessId: string, data: CreateVehicleDto, staffId?: string) {
    await this.assertDealershipVertical(businessId);

    const stockNumber = data.stockNumber || (await this.generateStockNumber(businessId));

    // Check stock number uniqueness
    const existing = await this.prisma.vehicle.findUnique({
      where: { businessId_stockNumber: { businessId, stockNumber } },
    });
    if (existing) throw new BadRequestException('Stock number already exists');

    // Check VIN uniqueness
    if (data.vin) {
      const vinExists = await this.prisma.vehicle.findUnique({ where: { vin: data.vin.toUpperCase() } });
      if (vinExists) throw new BadRequestException('VIN already exists');
    }

    if (data.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: data.locationId, businessId },
      });
      if (!loc) throw new NotFoundException('Location not found');
    }

    return this.prisma.vehicle.create({
      data: {
        businessId,
        stockNumber,
        vin: data.vin?.toUpperCase(),
        year: data.year,
        make: data.make,
        model: data.model,
        trim: data.trim,
        color: data.color,
        mileage: data.mileage,
        condition: data.condition || 'NEW',
        status: data.status || 'IN_STOCK',
        askingPrice: data.askingPrice,
        costPrice: data.costPrice,
        description: data.description,
        features: data.features || [],
        imageUrls: data.imageUrls || [],
        locationId: data.locationId,
        addedById: staffId,
      },
      include: { location: true, addedBy: { select: { id: true, name: true } } },
    });
  }

  async findAll(businessId: string, query: ListVehiclesDto) {
    await this.assertDealershipVertical(businessId);

    const where: any = { businessId, status: { not: 'ARCHIVED' } };

    if (query.status) where.status = query.status;
    if (query.condition) where.condition = query.condition;
    if (query.make) where.make = { contains: query.make, mode: 'insensitive' };
    if (query.model) where.model = { contains: query.model, mode: 'insensitive' };
    if (query.locationId) where.locationId = query.locationId;

    if (query.yearMin || query.yearMax) {
      where.year = {};
      if (query.yearMin) where.year.gte = query.yearMin;
      if (query.yearMax) where.year.lte = query.yearMax;
    }

    if (query.priceMin !== undefined || query.priceMax !== undefined) {
      where.askingPrice = {};
      if (query.priceMin !== undefined) where.askingPrice.gte = query.priceMin;
      if (query.priceMax !== undefined) where.askingPrice.lte = query.priceMax;
    }

    if (query.search) {
      where.OR = [
        { make: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
        { stockNumber: { contains: query.search, mode: 'insensitive' } },
        { vin: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    orderBy[sortBy] = sortOrder;

    const [data, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        orderBy,
        skip: query.skip || 0,
        take: Math.min(query.take || 20, 100),
        include: {
          location: true,
          addedBy: { select: { id: true, name: true } },
          _count: { select: { testDrives: true } },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(businessId: string, id: string) {
    await this.assertDealershipVertical(businessId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, businessId },
      include: {
        location: true,
        addedBy: { select: { id: true, name: true } },
        testDrives: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            staff: { select: { id: true, name: true } },
            booking: { select: { id: true, startTime: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async update(businessId: string, id: string, data: UpdateVehicleDto) {
    await this.assertDealershipVertical(businessId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, businessId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    // Check stock number uniqueness if changing
    if (data.stockNumber && data.stockNumber !== vehicle.stockNumber) {
      const exists = await this.prisma.vehicle.findUnique({
        where: { businessId_stockNumber: { businessId, stockNumber: data.stockNumber } },
      });
      if (exists) throw new BadRequestException('Stock number already exists');
    }

    // Check VIN uniqueness if changing
    if (data.vin && data.vin.toUpperCase() !== vehicle.vin) {
      const vinExists = await this.prisma.vehicle.findUnique({ where: { vin: data.vin.toUpperCase() } });
      if (vinExists) throw new BadRequestException('VIN already exists');
    }

    if (data.locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: data.locationId, businessId },
      });
      if (!loc) throw new NotFoundException('Location not found');
    }

    // Set soldAt when status changes to SOLD
    const updateData: any = { ...data };
    if (data.vin) updateData.vin = data.vin.toUpperCase();
    if (data.status === 'SOLD' && vehicle.status !== 'SOLD') {
      updateData.soldAt = new Date();
    }
    if (data.status && data.status !== 'SOLD' && vehicle.status === 'SOLD') {
      updateData.soldAt = null;
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: updateData,
      include: {
        location: true,
        addedBy: { select: { id: true, name: true } },
      },
    });
  }

  async remove(businessId: string, id: string) {
    await this.assertDealershipVertical(businessId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, businessId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    return this.prisma.vehicle.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async stats(businessId: string) {
    await this.assertDealershipVertical(businessId);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { businessId, status: { not: 'ARCHIVED' } },
      select: { status: true, askingPrice: true, createdAt: true },
    });

    const countByStatus: Record<string, number> = {};
    let totalValue = 0;
    let totalDaysOnLot = 0;
    let inStockCount = 0;
    const now = new Date();

    for (const v of vehicles) {
      countByStatus[v.status] = (countByStatus[v.status] || 0) + 1;
      if (v.askingPrice) totalValue += Number(v.askingPrice);
      if (v.status === 'IN_STOCK') {
        inStockCount++;
        totalDaysOnLot += Math.floor((now.getTime() - v.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      total: vehicles.length,
      countByStatus,
      totalValue: Math.round(totalValue * 100) / 100,
      avgDaysOnLot: inStockCount > 0 ? Math.round(totalDaysOnLot / inStockCount) : 0,
    };
  }
}
