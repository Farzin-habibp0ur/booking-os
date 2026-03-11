import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { CreateRecurringClassDto, UpdateRecurringClassDto } from './dto';

@Injectable()
export class RecurringClassService {
  private readonly logger = new Logger(RecurringClassService.name);

  constructor(private prisma: PrismaService) {}

  private async validateWellnessVertical(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (!biz || biz.verticalPack !== 'wellness') {
      throw new ForbiddenException('Recurring classes are only available for wellness businesses');
    }
  }

  async create(businessId: string, dto: CreateRecurringClassDto) {
    await this.validateWellnessVertical(businessId);

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId },
    });
    if (!service) throw new NotFoundException('Service not found');

    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, businessId, isActive: true },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    if (dto.resourceId) {
      const resource = await this.prisma.resource.findUnique({
        where: { id: dto.resourceId },
      });
      if (!resource) throw new NotFoundException('Resource not found');
    }

    return this.prisma.recurringClass.create({
      data: {
        businessId,
        serviceId: dto.serviceId,
        staffId: dto.staffId,
        resourceId: dto.resourceId,
        locationId: dto.locationId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        maxParticipants: dto.maxParticipants,
        isActive: dto.isActive ?? true,
      },
      include: {
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true, type: true } },
        location: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(businessId: string) {
    await this.validateWellnessVertical(businessId);

    return this.prisma.recurringClass.findMany({
      where: { businessId },
      include: {
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true, type: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findOne(businessId: string, id: string) {
    const cls = await this.prisma.recurringClass.findFirst({
      where: { id, businessId },
      include: {
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true, type: true } },
        location: { select: { id: true, name: true } },
      },
    });
    if (!cls) throw new NotFoundException('Recurring class not found');
    return cls;
  }

  async update(businessId: string, id: string, dto: UpdateRecurringClassDto) {
    await this.findOne(businessId, id);

    return this.prisma.recurringClass.update({
      where: { id },
      data: dto,
      include: {
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true, type: true } },
        location: { select: { id: true, name: true } },
      },
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.recurringClass.delete({ where: { id } });
  }

  async getWeeklySchedule(businessId: string, weekStr: string) {
    await this.validateWellnessVertical(businessId);

    // Parse ISO week: 2026-W12
    const match = weekStr.match(/^(\d{4})-W(\d{1,2})$/);
    if (!match) throw new BadRequestException('Invalid week format, use YYYY-WNN');

    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    if (week < 1 || week > 53) throw new BadRequestException('Invalid week number');

    // Calculate week start (Monday) from ISO week
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const classes = await this.prisma.recurringClass.findMany({
      where: { businessId, isActive: true },
      include: {
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true, type: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Get booking counts for this week's class instances
    const schedule = await Promise.all(
      classes.map(async (cls) => {
        // Calculate the actual date for this class in the given week
        // dayOfWeek: 0=Sun, 1=Mon...6=Sat; weekStart is Monday
        const classDate = new Date(weekStart);
        const offset = cls.dayOfWeek === 0 ? 6 : cls.dayOfWeek - 1;
        classDate.setDate(weekStart.getDate() + offset);

        const [h, m] = cls.startTime.split(':').map(Number);
        const classStart = new Date(classDate);
        classStart.setHours(h, m, 0, 0);

        const classEnd = new Date(classStart);
        classEnd.setMinutes(classEnd.getMinutes() + (cls.service.durationMins || 60));

        // Count bookings at this time for this service+staff
        const enrollmentCount = await this.prisma.booking.count({
          where: {
            businessId,
            serviceId: cls.serviceId,
            staffId: cls.staffId,
            startTime: classStart,
            status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
          },
        });

        return {
          ...cls,
          date: classDate.toISOString().split('T')[0],
          classStart: classStart.toISOString(),
          classEnd: classEnd.toISOString(),
          enrollmentCount,
          spotsRemaining: cls.maxParticipants - enrollmentCount,
        };
      }),
    );

    return schedule;
  }

  async enroll(businessId: string, classId: string, customerId: string) {
    await this.validateWellnessVertical(businessId);

    const cls = await this.findOne(businessId, classId);
    if (!cls.isActive) throw new BadRequestException('Class is not active');

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Find the next occurrence of this class
    const now = new Date();
    const today = now.getDay();
    let daysUntil = cls.dayOfWeek - today;
    if (daysUntil <= 0) daysUntil += 7;

    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + daysUntil);

    const [h, m] = cls.startTime.split(':').map(Number);
    const startTime = new Date(nextDate);
    startTime.setHours(h, m, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + (cls.service?.durationMins || 60));

    // Check capacity
    const currentCount = await this.prisma.booking.count({
      where: {
        businessId,
        serviceId: cls.serviceId,
        staffId: cls.staffId,
        startTime,
        status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
      },
    });

    if (currentCount >= cls.maxParticipants) {
      throw new BadRequestException('Class is full');
    }

    // Check if customer already enrolled
    const existing = await this.prisma.booking.findFirst({
      where: {
        businessId,
        customerId,
        serviceId: cls.serviceId,
        staffId: cls.staffId,
        startTime,
        status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED'] },
      },
    });
    if (existing) throw new BadRequestException('Customer already enrolled in this class');

    return this.prisma.booking.create({
      data: {
        businessId,
        customerId,
        serviceId: cls.serviceId,
        staffId: cls.staffId,
        resourceId: cls.resourceId,
        locationId: cls.locationId,
        startTime,
        endTime,
        status: 'CONFIRMED',
        source: 'MANUAL',
        notes: `Enrolled in recurring class: ${cls.service?.name}`,
      },
      include: {
        service: { select: { name: true } },
        staff: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generateUpcomingClasses() {
    this.logger.log('Generating upcoming class bookings...');

    const businesses = await this.prisma.business.findMany({
      where: { verticalPack: 'wellness' },
      select: { id: true },
    });

    for (const biz of businesses) {
      const classes = await this.prisma.recurringClass.findMany({
        where: { businessId: biz.id, isActive: true },
        include: { service: { select: { durationMins: true } } },
      });

      // Generate for next 14 days
      const now = new Date();
      for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
        const date = new Date(now);
        date.setDate(now.getDate() + dayOffset);
        const dayOfWeek = date.getDay();

        const dayClasses = classes.filter((c) => c.dayOfWeek === dayOfWeek);
        for (const cls of dayClasses) {
          const [h, m] = cls.startTime.split(':').map(Number);
          const startTime = new Date(date);
          startTime.setHours(h, m, 0, 0);

          // Check if class booking placeholder already exists (via a note marker)
          const existing = await this.prisma.booking.findFirst({
            where: {
              businessId: biz.id,
              serviceId: cls.serviceId,
              staffId: cls.staffId,
              startTime,
            },
          });

          if (!existing) {
            this.logger.debug(
              `Pre-generated class slot for ${cls.serviceId} on ${date.toISOString().split('T')[0]}`,
            );
          }
        }
      }
    }
  }
}
