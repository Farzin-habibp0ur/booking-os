import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateTestDriveDto, UpdateTestDriveDto } from './dto';

@Injectable()
export class TestDriveService {
  constructor(private prisma: PrismaService) {}

  private async assertDealershipVertical(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (biz?.verticalPack !== 'dealership') {
      throw new ForbiddenException('Test drives are only available for dealership businesses');
    }
  }

  private readonly include = {
    vehicle: {
      select: { id: true, stockNumber: true, year: true, make: true, model: true, vin: true },
    },
    customer: { select: { id: true, name: true, phone: true, email: true } },
    staff: { select: { id: true, name: true } },
    booking: { select: { id: true, startTime: true, endTime: true, status: true } },
  };

  async create(businessId: string, data: CreateTestDriveDto) {
    await this.assertDealershipVertical(businessId);

    // Validate vehicle
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: data.vehicleId, businessId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.status === 'SOLD' || vehicle.status === 'ARCHIVED') {
      throw new BadRequestException('Vehicle is not available for test drives');
    }

    // Validate customer
    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, businessId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Validate staff if provided
    if (data.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: data.staffId, businessId, isActive: true },
      });
      if (!staff) throw new NotFoundException('Staff not found');
    }

    // Find the "Test Drive" service for this business
    const testDriveService = await this.prisma.service.findFirst({
      where: { businessId, name: { contains: 'Test Drive', mode: 'insensitive' }, isActive: true },
    });

    let bookingId: string | undefined;

    if (testDriveService) {
      const startTime = new Date(data.startTime);
      const endTime = new Date(startTime.getTime() + testDriveService.durationMins * 60 * 1000);

      const booking = await this.prisma.booking.create({
        data: {
          businessId,
          customerId: data.customerId,
          serviceId: testDriveService.id,
          staffId: data.staffId,
          startTime,
          endTime,
          status: 'CONFIRMED',
          source: 'MANUAL',
          notes: `Test drive: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.stockNumber ? ` (${vehicle.stockNumber})` : ''}`,
        },
      });
      bookingId = booking.id;
    }

    return this.prisma.testDrive.create({
      data: {
        vehicleId: data.vehicleId,
        customerId: data.customerId,
        staffId: data.staffId,
        bookingId,
        notes: data.notes,
      },
      include: this.include,
    });
  }

  async update(businessId: string, id: string, data: UpdateTestDriveDto) {
    await this.assertDealershipVertical(businessId);

    const testDrive = await this.prisma.testDrive.findFirst({
      where: { id, vehicle: { businessId } },
    });
    if (!testDrive) throw new NotFoundException('Test drive not found');

    // Update linked booking status if test drive status changes
    if (data.status && testDrive.bookingId) {
      const bookingStatusMap: Record<string, string> = {
        COMPLETED: 'COMPLETED',
        NO_SHOW: 'NO_SHOW',
        CANCELLED: 'CANCELLED',
      };
      const newBookingStatus = bookingStatusMap[data.status];
      if (newBookingStatus) {
        await this.prisma.booking.update({
          where: { id: testDrive.bookingId },
          data: { status: newBookingStatus },
        });
      }
    }

    return this.prisma.testDrive.update({
      where: { id },
      data,
      include: this.include,
    });
  }

  async findByVehicle(businessId: string, vehicleId: string) {
    await this.assertDealershipVertical(businessId);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, businessId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    return this.prisma.testDrive.findMany({
      where: { vehicleId },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCustomer(businessId: string, customerId: string) {
    await this.assertDealershipVertical(businessId);

    return this.prisma.testDrive.findMany({
      where: { customerId, vehicle: { businessId } },
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(businessId: string, query: { vehicleId?: string; customerId?: string }) {
    await this.assertDealershipVertical(businessId);

    const where: any = { vehicle: { businessId } };
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.customerId) where.customerId = query.customerId;

    return this.prisma.testDrive.findMany({
      where,
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }
}
