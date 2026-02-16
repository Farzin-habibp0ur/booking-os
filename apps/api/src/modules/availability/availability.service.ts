import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';

export interface TimeSlot {
  time: string; // ISO string
  display: string; // "09:00"
  staffId: string;
  staffName: string;
  available: boolean;
}

@Injectable()
export class AvailabilityService {
  private readonly logger = new Logger(AvailabilityService.name);

  constructor(
    private prisma: PrismaService,
    private calendarSyncService: CalendarSyncService,
  ) {}

  async getAvailableSlots(
    businessId: string,
    date: string, // YYYY-MM-DD
    serviceId: string,
    staffId?: string,
  ): Promise<TimeSlot[]> {
    // Get service duration
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
    });
    if (!service) return [];
    const durationMins = service.durationMins;

    // Get staff to check
    const staffWhere: any = { businessId, isActive: true };
    if (staffId) staffWhere.id = staffId;
    const staffList = await this.prisma.staff.findMany({
      where: staffWhere,
      select: { id: true, name: true },
    });

    const targetDate = new Date(date + 'T00:00:00');
    const dayOfWeek = targetDate.getDay();

    const allSlots: TimeSlot[] = [];

    for (const staff of staffList) {
      // Get working hours for this day
      const wh = await this.prisma.workingHours.findUnique({
        where: { staffId_dayOfWeek: { staffId: staff.id, dayOfWeek } },
      });

      if (!wh || wh.isOff) continue;

      // Check time off
      const timeOff = await this.prisma.timeOff.findFirst({
        where: {
          staffId: staff.id,
          startDate: { lte: new Date(date + 'T23:59:59') },
          endDate: { gte: new Date(date + 'T00:00:00') },
        },
      });
      if (timeOff) continue;

      // Get existing bookings for this staff on this date
      const dayStart = new Date(date + 'T00:00:00');
      const dayEnd = new Date(date + 'T23:59:59');
      const existingBookings = await this.prisma.booking.findMany({
        where: {
          businessId,
          staffId: staff.id,
          status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
          startTime: { gte: dayStart },
          endTime: { lte: dayEnd },
        },
        select: { startTime: true, endTime: true },
      });

      // Pull external calendar events for conflict detection
      let externalEvents: { startTime: Date; endTime: Date }[] = [];
      try {
        externalEvents = await this.calendarSyncService.pullExternalEvents(staff.id, date);
      } catch (error) {
        this.logger.warn(`Failed to pull external events for staff ${staff.id}: ${error}`);
      }

      // Generate slots from working hours
      const [startH, startM] = wh.startTime.split(':').map(Number);
      const [endH, endM] = wh.endTime.split(':').map(Number);

      const workStart = startH * 60 + startM;
      const workEnd = endH * 60 + endM;

      // Generate 30-min increment slots
      const slotIncrement = 30;
      for (let mins = workStart; mins + durationMins <= workEnd; mins += slotIncrement) {
        const slotStart = new Date(targetDate);
        slotStart.setHours(Math.floor(mins / 60), mins % 60, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + durationMins);

        // Check for internal booking conflicts
        const internalConflict = existingBookings.some((b) => {
          const bStart = new Date(b.startTime).getTime();
          const bEnd = new Date(b.endTime).getTime();
          return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
        });

        // Check for external calendar conflicts
        const externalConflict = externalEvents.some((e) => {
          return slotStart.getTime() < e.endTime.getTime() && slotEnd.getTime() > e.startTime.getTime();
        });

        const hasConflict = internalConflict || externalConflict;

        // Skip past slots
        if (slotStart.getTime() < Date.now()) continue;

        const hours = Math.floor(mins / 60);
        const minutes = mins % 60;
        const display = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        allSlots.push({
          time: slotStart.toISOString(),
          display,
          staffId: staff.id,
          staffName: staff.name,
          available: !hasConflict,
        });
      }
    }

    // Sort by time then staff
    allSlots.sort((a, b) => a.time.localeCompare(b.time) || a.staffName.localeCompare(b.staffName));

    return allSlots;
  }

  async getStaffWorkingHours(businessId: string, staffId: string) {
    // Verify staff belongs to this business
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) return [];

    return this.prisma.workingHours.findMany({
      where: { staffId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async setStaffWorkingHours(
    businessId: string,
    staffId: string,
    hours: { dayOfWeek: number; startTime: string; endTime: string; isOff: boolean }[],
  ) {
    // Verify staff belongs to this business
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) throw new Error('Staff not found');

    // Upsert each day
    for (const h of hours) {
      await this.prisma.workingHours.upsert({
        where: { staffId_dayOfWeek: { staffId, dayOfWeek: h.dayOfWeek } },
        create: {
          staffId,
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
          isOff: h.isOff,
        },
        update: { startTime: h.startTime, endTime: h.endTime, isOff: h.isOff },
      });
    }
    return this.getStaffWorkingHours(businessId, staffId);
  }

  async getStaffTimeOff(businessId: string, staffId: string) {
    // Verify staff belongs to this business
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) return [];

    return this.prisma.timeOff.findMany({
      where: { staffId, endDate: { gte: new Date() } },
      orderBy: { startDate: 'asc' },
    });
  }

  async addTimeOff(
    businessId: string,
    staffId: string,
    data: { startDate: string; endDate: string; reason?: string },
  ) {
    // Verify staff belongs to this business
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, businessId },
    });
    if (!staff) throw new Error('Staff not found');

    return this.prisma.timeOff.create({
      data: {
        staffId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason,
      },
    });
  }

  async removeTimeOff(businessId: string, id: string) {
    // Verify time-off belongs to a staff member of this business
    const timeOff = await this.prisma.timeOff.findUnique({
      where: { id },
      include: { staff: { select: { businessId: true } } },
    });
    if (!timeOff || timeOff.staff.businessId !== businessId) {
      throw new Error('Time off entry not found');
    }

    return this.prisma.timeOff.delete({ where: { id } });
  }
}
