import { Injectable, Logger } from '@nestjs/common';
import { fromZonedTime } from 'date-fns-tz';
import { PrismaService } from '../../common/prisma.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';

export interface TimeSlot {
  time: string; // ISO string
  display: string; // "09:00"
  staffId: string;
  staffName: string;
  available: boolean;
  resourceId?: string;
  resourceName?: string;
  spotsRemaining?: number;
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
    locationId?: string,
    resourceId?: string,
  ): Promise<TimeSlot[]> {
    // Get service duration and group/resource settings
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
    });
    if (!service) return [];
    const durationMins = service.durationMins;
    const isGroupClass = (service as any).maxParticipants > 1;
    const maxParticipants = (service as any).maxParticipants || 1;

    // Fetch business timezone for correct slot generation
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });
    const tz = business?.timezone || 'UTC';

    // Get staff to check
    const staffWhere: any = { businessId, isActive: true };
    if (staffId) staffWhere.id = staffId;
    let staffList = await this.prisma.staff.findMany({
      where: staffWhere,
      select: { id: true, name: true },
    });

    // Filter staff by service capability (StaffServicePrice records)
    if (staffList.length > 0) {
      const capabilities =
        (await this.prisma.staffServicePrice.findMany({
          where: { businessId, serviceId },
          select: { staffId: true },
        })) || [];
      if (capabilities.length > 0) {
        const capableStaffIds = new Set(capabilities.map((c) => c.staffId));
        staffList = staffList.filter((s) => capableStaffIds.has(s.id));
      }
      // If no StaffServicePrice records exist for this service at all,
      // assume all staff can perform it (backward compatibility)
    }

    // Filter staff by location assignment when locationId is provided
    if (locationId && staffList.length > 0) {
      const assignments = await this.prisma.staffLocation.findMany({
        where: { locationId },
        select: { staffId: true },
      });
      const assignedStaffIds = new Set(assignments.map((a) => a.staffId));
      staffList = staffList.filter((s) => assignedStaffIds.has(s.id));
    }

    const targetDate = fromZonedTime(date + 'T00:00:00', tz);
    // Compute day-of-week in the business timezone (0=Sun … 6=Sat)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames.indexOf(
      new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(targetDate),
    );

    // Auto-find matching resource if service requires a specific type
    let effectiveResourceId = resourceId;
    let effectiveResourceName: string | undefined;
    const requiredResType = (service as any).requiredResourceType;
    if (!effectiveResourceId && requiredResType) {
      const matchingResources = await this.prisma.resource.findMany({
        where: { type: requiredResType, isActive: true },
        select: { id: true, name: true },
      });
      if (matchingResources.length > 0) {
        effectiveResourceId = matchingResources[0].id;
        effectiveResourceName = matchingResources[0].name;
      }
    }

    // Pre-fetch resource bookings for conflict detection
    let resourceBookings: { startTime: Date; endTime: Date }[] = [];
    if (effectiveResourceId) {
      const dayStart = fromZonedTime(date + 'T00:00:00', tz);
      const dayEnd = fromZonedTime(date + 'T23:59:59', tz);
      resourceBookings = await this.prisma.booking.findMany({
        where: {
          businessId,
          resourceId: effectiveResourceId,
          status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
          startTime: { gte: dayStart },
          endTime: { lte: dayEnd },
        },
        select: { startTime: true, endTime: true },
      });
    }

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
          startDate: { lte: fromZonedTime(date + 'T23:59:59', tz) },
          endDate: { gte: fromZonedTime(date + 'T00:00:00', tz) },
        },
      });
      if (timeOff) continue;

      // Get existing bookings for this staff on this date
      const dayStart = fromZonedTime(date + 'T00:00:00', tz);
      const dayEnd = fromZonedTime(date + 'T23:59:59', tz);
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
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        const slotStart = fromZonedTime(`${date}T${hh}:${mm}:00`, tz);

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
          return (
            slotStart.getTime() < e.endTime.getTime() && slotEnd.getTime() > e.startTime.getTime()
          );
        });

        // Check for resource booking conflicts
        const resourceConflict = effectiveResourceId
          ? resourceBookings.some((rb) => {
              const rbStart = new Date(rb.startTime).getTime();
              const rbEnd = new Date(rb.endTime).getTime();
              return slotStart.getTime() < rbEnd && slotEnd.getTime() > rbStart;
            })
          : false;

        // For group classes: check enrollment count instead of simple conflict
        let spotsRemaining: number | undefined;
        if (isGroupClass) {
          const enrolledCount = existingBookings.filter((b) => {
            const bStart = new Date(b.startTime).getTime();
            return bStart === slotStart.getTime();
          }).length;
          spotsRemaining = maxParticipants - enrolledCount;
        }

        const hasConflict = isGroupClass
          ? (spotsRemaining !== undefined && spotsRemaining <= 0) ||
            externalConflict ||
            resourceConflict
          : internalConflict || externalConflict || resourceConflict;

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
          ...(effectiveResourceId
            ? { resourceId: effectiveResourceId, resourceName: effectiveResourceName }
            : {}),
          ...(isGroupClass ? { spotsRemaining } : {}),
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

  async getRecommendedSlots(
    businessId: string,
    serviceId: string,
    date: string,
    excludeBookingId?: string,
  ) {
    // Get all available slots for the date
    const allSlots = await this.getAvailableSlots(businessId, date, serviceId);
    const availableSlots = allSlots.filter((s) => s.available);

    if (availableSlots.length === 0) return [];

    // Count existing bookings per staff for load balancing
    const dayStart = new Date(date + 'T00:00:00');
    const dayEnd = new Date(date + 'T23:59:59');
    const bookings = await this.prisma.booking.findMany({
      where: {
        businessId,
        status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
        startTime: { gte: dayStart },
        endTime: { lte: dayEnd },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { staffId: true },
    });

    const staffLoadMap: Record<string, number> = {};
    for (const b of bookings) {
      if (b.staffId) {
        staffLoadMap[b.staffId] = (staffLoadMap[b.staffId] || 0) + 1;
      }
    }

    // Score slots: prefer mid-day and lower staff load
    const scored = availableSlots.map((slot) => {
      const slotDate = new Date(slot.time);
      const hour = slotDate.getHours() + slotDate.getMinutes() / 60;
      // Proximity to mid-day (12:00): lower = better
      const proximityScore = Math.abs(hour - 12);
      // Staff balance: fewer bookings = better
      const loadScore = staffLoadMap[slot.staffId] || 0;
      // Combined score (lower is better)
      const score = proximityScore * 2 + loadScore * 3;
      return { ...slot, score };
    });

    scored.sort((a, b) => a.score - b.score);

    return scored.slice(0, 5).map(({ score, ...slot }) => slot);
  }

  async getCalendarContext(
    businessId: string,
    staffIds: string[],
    dateFrom: string,
    dateTo: string,
  ) {
    const result: Record<
      string,
      {
        workingHours: { dayOfWeek: number; startTime: string; endTime: string; isOff: boolean }[];
        timeOff: { startDate: string; endDate: string; reason: string | null }[];
      }
    > = {};

    // Verify all staff belong to this business
    const staffList = await this.prisma.staff.findMany({
      where: { id: { in: staffIds }, businessId },
      select: { id: true },
    });
    const validIds = staffList.map((s) => s.id);

    // Batch fetch working hours
    const workingHours = await this.prisma.workingHours.findMany({
      where: { staffId: { in: validIds } },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Batch fetch time-off overlapping the date range
    const timeOffs = await this.prisma.timeOff.findMany({
      where: {
        staffId: { in: validIds },
        startDate: { lte: new Date(dateTo) },
        endDate: { gte: new Date(dateFrom) },
      },
      orderBy: { startDate: 'asc' },
    });

    for (const id of validIds) {
      result[id] = {
        workingHours: workingHours
          .filter((wh) => wh.staffId === id)
          .map((wh) => ({
            dayOfWeek: wh.dayOfWeek,
            startTime: wh.startTime,
            endTime: wh.endTime,
            isOff: wh.isOff,
          })),
        timeOff: timeOffs
          .filter((to) => to.staffId === id)
          .map((to) => ({
            startDate: to.startDate.toISOString(),
            endDate: to.endDate.toISOString(),
            reason: to.reason,
          })),
      };
    }

    return result;
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
