import { Test } from '@nestjs/testing';
import { AvailabilityService, TimeSlot } from './availability.service';
import { PrismaService } from '../../common/prisma.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import { createMockPrisma, createMockCalendarSyncService } from '../../test/mocks';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockCalendarSyncService: ReturnType<typeof createMockCalendarSyncService>;

  // Use a far-future date so slots are never filtered out as "past"
  const FUTURE_DATE = '2028-06-15'; // Thursday (dayOfWeek = 4)
  const FUTURE_DATE_DOW = 4;

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockCalendarSyncService = createMockCalendarSyncService();

    const module = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: CalendarSyncService, useValue: mockCalendarSyncService },
      ],
    }).compile();

    service = module.get(AvailabilityService);
  });

  // ─── getAvailableSlots ────────────────────────────────────────────────

  describe('getAvailableSlots', () => {
    it('returns empty array when service is not found', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc-bad');

      expect(result).toEqual([]);
      expect(prisma.staff.findMany).not.toHaveBeenCalled();
    });

    it('returns empty array when no active staff exist', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(result).toEqual([]);
    });

    it('filters staff by specific staffId when provided', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([]);

      await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1', 'staff1');

      expect(prisma.staff.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', isActive: true, id: 'staff1' },
        select: { id: true, name: true },
      });
    });

    it('fetches all active staff when no staffId is given', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([]);

      await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(prisma.staff.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', isActive: true },
        select: { id: true, name: true },
      });
    });

    it('skips staff with no working hours for the target day', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue(null);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(result).toEqual([]);
    });

    it('skips staff whose working hours have isOff = true', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '17:00',
        isOff: true,
      } as any);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(result).toEqual([]);
    });

    it('skips staff who are on time off for the target date', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue({
        id: 'to1',
        staffId: 'staff1',
        startDate: new Date(FUTURE_DATE + 'T00:00:00'),
        endDate: new Date(FUTURE_DATE + 'T23:59:59'),
      } as any);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(result).toEqual([]);
    });

    it('generates 30-minute increment slots within working hours', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '11:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // 09:00-11:00 with 30-min service: 09:00, 09:30, 10:00, 10:30
      expect(result).toHaveLength(4);
      expect(result.map((s: TimeSlot) => s.display)).toEqual(['09:00', '09:30', '10:00', '10:30']);
      expect(result.every((s: TimeSlot) => s.available)).toBe(true);
      expect(result.every((s: TimeSlot) => s.staffId === 'staff1')).toBe(true);
      expect(result.every((s: TimeSlot) => s.staffName === 'Dr. Chen')).toBe(true);
    });

    it('respects service duration when computing slots (60-min service)', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 60,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '11:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // 09:00-11:00 with 60-min service: 09:00, 09:30, 10:00 (10:30 would end at 11:30 > 11:00)
      expect(result).toHaveLength(3);
      expect(result.map((s: TimeSlot) => s.display)).toEqual(['09:00', '09:30', '10:00']);
    });

    it('marks slots as unavailable when they conflict with existing bookings', async () => {
      const bookingStart = new Date(FUTURE_DATE + 'T10:00:00');
      const bookingEnd = new Date(FUTURE_DATE + 'T11:00:00');

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '12:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([
        { startTime: bookingStart, endTime: bookingEnd },
      ] as any);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // 10:00 slot (10:00-10:30) overlaps with booking 10:00-11:00 -> unavailable
      // 10:30 slot (10:30-11:00) overlaps with booking 10:00-11:00 -> unavailable
      const slot1000 = result.find((s: TimeSlot) => s.display === '10:00');
      const slot1030 = result.find((s: TimeSlot) => s.display === '10:30');
      const slot0900 = result.find((s: TimeSlot) => s.display === '09:00');
      const slot1100 = result.find((s: TimeSlot) => s.display === '11:00');

      expect(slot1000?.available).toBe(false);
      expect(slot1030?.available).toBe(false);
      expect(slot0900?.available).toBe(true);
      expect(slot1100?.available).toBe(true);
    });

    it('marks slots as unavailable when they conflict with external calendar events', async () => {
      const eventStart = new Date(FUTURE_DATE + 'T14:00:00');
      const eventEnd = new Date(FUTURE_DATE + 'T15:00:00');

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '13:00',
        endTime: '16:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([
        { startTime: eventStart, endTime: eventEnd },
      ]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      const slot1400 = result.find((s: TimeSlot) => s.display === '14:00');
      const slot1430 = result.find((s: TimeSlot) => s.display === '14:30');
      const slot1300 = result.find((s: TimeSlot) => s.display === '13:00');
      const slot1500 = result.find((s: TimeSlot) => s.display === '15:00');

      expect(slot1400?.available).toBe(false);
      expect(slot1430?.available).toBe(false);
      expect(slot1300?.available).toBe(true);
      expect(slot1500?.available).toBe(true);
    });

    it('marks slot unavailable when both internal and external conflicts exist', async () => {
      const start = new Date(FUTURE_DATE + 'T10:00:00');
      const end = new Date(FUTURE_DATE + 'T10:30:00');

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '12:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([{ startTime: start, endTime: end }] as any);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([
        { startTime: start, endTime: end },
      ]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      const slot1000 = result.find((s: TimeSlot) => s.display === '10:00');
      expect(slot1000?.available).toBe(false);
    });

    it('gracefully handles external calendar fetch failures', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockRejectedValue(new Error('Google API error'));

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // Should still return slots even though external calendar failed
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((s: TimeSlot) => s.available)).toBe(true);
    });

    it('queries bookings with correct status filter', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            staffId: 'staff1',
            status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
          }),
        }),
      );
    });

    it('returns slots for multiple staff members sorted by time then staff name', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([
        { id: 'staff1', name: 'Dr. Chen' },
        { id: 'staff2', name: 'Ava Smith' },
      ] as any);

      // Staff1: 09:00-10:00
      prisma.workingHours.findUnique
        .mockResolvedValueOnce({
          staffId: 'staff1',
          dayOfWeek: FUTURE_DATE_DOW,
          startTime: '09:00',
          endTime: '10:00',
          isOff: false,
        } as any)
        .mockResolvedValueOnce({
          staffId: 'staff2',
          dayOfWeek: FUTURE_DATE_DOW,
          startTime: '09:00',
          endTime: '10:00',
          isOff: false,
        } as any);

      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // 2 staff x 2 slots each (09:00, 09:30) = 4 total
      expect(result).toHaveLength(4);

      // Sorted by time first, then staff name
      expect(result[0].display).toBe('09:00');
      expect(result[0].staffName).toBe('Ava Smith');
      expect(result[1].display).toBe('09:00');
      expect(result[1].staffName).toBe('Dr. Chen');
      expect(result[2].display).toBe('09:30');
      expect(result[2].staffName).toBe('Ava Smith');
      expect(result[3].display).toBe('09:30');
      expect(result[3].staffName).toBe('Dr. Chen');
    });

    it('generates correct ISO time strings for each slot', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // Verify that time is a valid ISO string
      for (const slot of result) {
        expect(new Date(slot.time).toISOString()).toBe(slot.time);
      }
    });

    it('handles boundary: service duration equals working hours window', async () => {
      // Working from 09:00-10:00 with 60-min service => exactly one slot at 09:00
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 60,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(result).toHaveLength(1);
      expect(result[0].display).toBe('09:00');
    });

    it('handles boundary: service duration exceeds working hours window', async () => {
      // Working 09:00-09:30 but service is 60 min => no slots
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 60,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '09:30',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(result).toEqual([]);
    });

    it('handles non-aligned working hours (e.g. 09:15 start)', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:15',
        endTime: '10:45',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // 09:15, 09:45, 10:15 (10:45 start + 30 = 11:15 > 10:45 end)
      expect(result).toHaveLength(3);
      expect(result[0].display).toBe('09:15');
      expect(result[1].display).toBe('09:45');
      expect(result[2].display).toBe('10:15');
    });

    it('detects partial overlap at slot start boundary', async () => {
      // Booking from 09:45-10:15 should conflict with 09:30 slot (09:30-10:00)
      const bookingStart = new Date(FUTURE_DATE + 'T09:45:00');
      const bookingEnd = new Date(FUTURE_DATE + 'T10:15:00');

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '11:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([
        { startTime: bookingStart, endTime: bookingEnd },
      ] as any);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      const slot0900 = result.find((s: TimeSlot) => s.display === '09:00');
      const slot0930 = result.find((s: TimeSlot) => s.display === '09:30');
      const slot1000 = result.find((s: TimeSlot) => s.display === '10:00');
      const slot1030 = result.find((s: TimeSlot) => s.display === '10:30');

      expect(slot0900?.available).toBe(true);
      // 09:30 slot (09:30-10:00) overlaps with booking 09:45-10:15
      expect(slot0930?.available).toBe(false);
      // 10:00 slot (10:00-10:30) overlaps with booking 09:45-10:15
      expect(slot1000?.available).toBe(false);
      expect(slot1030?.available).toBe(true);
    });

    it('adjacent booking does not conflict (booking ends exactly when slot starts)', async () => {
      // Booking 09:00-09:30 should NOT conflict with 09:30 slot
      const bookingStart = new Date(FUTURE_DATE + 'T09:00:00');
      const bookingEnd = new Date(FUTURE_DATE + 'T09:30:00');

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:30',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([
        { startTime: bookingStart, endTime: bookingEnd },
      ] as any);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      const slot0900 = result.find((s: TimeSlot) => s.display === '09:00');
      const slot0930 = result.find((s: TimeSlot) => s.display === '09:30');

      expect(slot0900?.available).toBe(false);
      // Booking ends at 09:30, slot starts at 09:30 => no overlap
      expect(slot0930?.available).toBe(true);
    });

    it('calls pullExternalEvents for each staff member', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([
        { id: 'staff1', name: 'Dr. Chen' },
        { id: 'staff2', name: 'Ava Smith' },
      ] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      expect(mockCalendarSyncService.pullExternalEvents).toHaveBeenCalledTimes(2);
      expect(mockCalendarSyncService.pullExternalEvents).toHaveBeenCalledWith(
        'staff1',
        FUTURE_DATE,
      );
      expect(mockCalendarSyncService.pullExternalEvents).toHaveBeenCalledWith(
        'staff2',
        FUTURE_DATE,
      );
    });

    it('correctly determines dayOfWeek from date string', async () => {
      // 2028-06-12 is a Monday (dayOfWeek = 1)
      const monday = '2028-06-12';

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue(null);

      await service.getAvailableSlots('biz1', monday, 'svc1');

      expect(prisma.workingHours.findUnique).toHaveBeenCalledWith({
        where: { staffId_dayOfWeek: { staffId: 'staff1', dayOfWeek: 1 } },
      });
    });

    it('handles full-day working hours (00:00-23:30)', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '00:00',
        endTime: '23:30',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // 00:00 to 23:30 with 30-min service: 47 slots (00:00, 00:30, ..., 23:00)
      expect(result).toHaveLength(47);
      expect(result[0].display).toBe('00:00');
      expect(result[result.length - 1].display).toBe('23:00');
    });

    it('skips slots that are in the past (before Date.now())', async () => {
      // Use a date in the past — all slots should be filtered out
      const pastDate = '2020-01-15'; // Wednesday (dayOfWeek = 3)

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: 3,
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', pastDate, 'svc1');

      expect(result).toEqual([]);
    });

    // ─── Location-aware slot filtering ──────────────────────────────────

    it('filters staff by location assignment when locationId is provided', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([
        { id: 'staff1', name: 'Dr. Chen' },
        { id: 'staff2', name: 'Ava Smith' },
      ] as any);

      // Only staff1 is assigned to loc1
      prisma.staffLocation.findMany.mockResolvedValue([{ staffId: 'staff1' }] as any);

      prisma.workingHours.findUnique.mockResolvedValue({
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots(
        'biz1',
        FUTURE_DATE,
        'svc1',
        undefined,
        'loc1',
      );

      // Only staff1 slots should be returned (staff2 is not assigned to loc1)
      expect(result.every((s: TimeSlot) => s.staffId === 'staff1')).toBe(true);
      expect(result.every((s: TimeSlot) => s.staffName === 'Dr. Chen')).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns empty when no staff assigned to location', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);

      // No staff assigned to loc1
      prisma.staffLocation.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(
        'biz1',
        FUTURE_DATE,
        'svc1',
        undefined,
        'loc1',
      );

      expect(result).toEqual([]);
    });

    it('does not filter staff when no locationId is provided', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([
        { id: 'staff1', name: 'Dr. Chen' },
        { id: 'staff2', name: 'Ava Smith' },
      ] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // Both staff should have slots
      const staffIds = [...new Set(result.map((s: TimeSlot) => s.staffId))];
      expect(staffIds).toHaveLength(2);
      expect(prisma.staffLocation.findMany).not.toHaveBeenCalled();
    });

    // ─── Resource conflict detection ────────────────────────────────────

    it('marks slots unavailable when resource has conflicting bookings', async () => {
      const resourceBookingStart = new Date(FUTURE_DATE + 'T10:00:00');
      const resourceBookingEnd = new Date(FUTURE_DATE + 'T11:00:00');

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '12:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);

      // Staff has no booking conflicts
      prisma.booking.findMany
        .mockResolvedValueOnce([
          { startTime: resourceBookingStart, endTime: resourceBookingEnd },
        ] as any) // resource bookings query (first call)
        .mockResolvedValueOnce([] as any); // staff bookings query (second call)

      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots(
        'biz1',
        FUTURE_DATE,
        'svc1',
        undefined,
        undefined,
        'res1',
      );

      // 10:00 and 10:30 should be unavailable due to resource conflict
      const slot1000 = result.find((s: TimeSlot) => s.display === '10:00');
      const slot1030 = result.find((s: TimeSlot) => s.display === '10:30');
      const slot0900 = result.find((s: TimeSlot) => s.display === '09:00');
      const slot1100 = result.find((s: TimeSlot) => s.display === '11:00');

      expect(slot1000?.available).toBe(false);
      expect(slot1030?.available).toBe(false);
      expect(slot0900?.available).toBe(true);
      expect(slot1100?.available).toBe(true);
    });

    it('does not check resource conflicts when no resourceId is provided', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Dr. Chen' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 'staff1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots('biz1', FUTURE_DATE, 'svc1');

      // All slots should be available, booking.findMany only called once per staff (for staff conflicts, not resource)
      expect(result.every((s: TimeSlot) => s.available)).toBe(true);
    });

    it('combines location filtering with resource conflict detection', async () => {
      const resourceBookingStart = new Date(FUTURE_DATE + 'T09:00:00');
      const resourceBookingEnd = new Date(FUTURE_DATE + 'T09:30:00');

      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 30,
      } as any);
      prisma.staff.findMany.mockResolvedValue([
        { id: 'staff1', name: 'Dr. Chen' },
        { id: 'staff2', name: 'Ava Smith' },
      ] as any);

      // Only staff1 assigned to loc1
      prisma.staffLocation.findMany.mockResolvedValue([{ staffId: 'staff1' }] as any);

      prisma.workingHours.findUnique.mockResolvedValue({
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '10:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);

      // Resource has booking 09:00-09:30
      prisma.booking.findMany
        .mockResolvedValueOnce([
          { startTime: resourceBookingStart, endTime: resourceBookingEnd },
        ] as any) // resource bookings
        .mockResolvedValueOnce([] as any); // staff bookings

      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getAvailableSlots(
        'biz1',
        FUTURE_DATE,
        'svc1',
        undefined,
        'loc1',
        'res1',
      );

      // Only staff1 slots (location filter), 09:00 unavailable (resource conflict), 09:30 available
      expect(result.every((s: TimeSlot) => s.staffId === 'staff1')).toBe(true);
      const slot0900 = result.find((s: TimeSlot) => s.display === '09:00');
      const slot0930 = result.find((s: TimeSlot) => s.display === '09:30');
      expect(slot0900?.available).toBe(false);
      expect(slot0930?.available).toBe(true);
    });
  });

  // ─── getStaffWorkingHours ─────────────────────────────────────────────

  describe('getStaffWorkingHours', () => {
    it('returns working hours for a valid staff member', async () => {
      const workingHours = [
        {
          id: 'wh1',
          staffId: 'staff1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          isOff: false,
        },
        {
          id: 'wh2',
          staffId: 'staff1',
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '17:00',
          isOff: false,
        },
      ];
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', businessId: 'biz1' } as any);
      prisma.workingHours.findMany.mockResolvedValue(workingHours as any);

      const result = await service.getStaffWorkingHours('biz1', 'staff1');

      expect(result).toEqual(workingHours);
      expect(prisma.workingHours.findMany).toHaveBeenCalledWith({
        where: { staffId: 'staff1' },
        orderBy: { dayOfWeek: 'asc' },
      });
    });

    it('returns empty array when staff does not belong to the business', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      const result = await service.getStaffWorkingHours('biz1', 'staff-other');

      expect(result).toEqual([]);
      expect(prisma.workingHours.findMany).not.toHaveBeenCalled();
    });

    it('verifies staff belongs to correct business', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await service.getStaffWorkingHours('biz1', 'staff1');

      expect(prisma.staff.findFirst).toHaveBeenCalledWith({
        where: { id: 'staff1', businessId: 'biz1' },
      });
    });
  });

  // ─── setStaffWorkingHours ─────────────────────────────────────────────

  describe('setStaffWorkingHours', () => {
    const hoursInput = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isOff: false },
      { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', isOff: true },
    ];

    it('upserts working hours for each day and returns updated hours', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', businessId: 'biz1' } as any);
      prisma.workingHours.upsert.mockResolvedValue({} as any);
      prisma.workingHours.findMany.mockResolvedValue(hoursInput as any);

      const result = await service.setStaffWorkingHours('biz1', 'staff1', hoursInput);

      expect(prisma.workingHours.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.workingHours.upsert).toHaveBeenCalledWith({
        where: { staffId_dayOfWeek: { staffId: 'staff1', dayOfWeek: 1 } },
        create: {
          staffId: 'staff1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          isOff: false,
        },
        update: { startTime: '09:00', endTime: '17:00', isOff: false },
      });
      expect(prisma.workingHours.upsert).toHaveBeenCalledWith({
        where: { staffId_dayOfWeek: { staffId: 'staff1', dayOfWeek: 0 } },
        create: {
          staffId: 'staff1',
          dayOfWeek: 0,
          startTime: '00:00',
          endTime: '00:00',
          isOff: true,
        },
        update: { startTime: '00:00', endTime: '00:00', isOff: true },
      });
      expect(result).toEqual(hoursInput);
    });

    it('throws error when staff is not found', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(service.setStaffWorkingHours('biz1', 'bad-staff', hoursInput)).rejects.toThrow(
        'Staff not found',
      );
    });

    it('returns result of getStaffWorkingHours after setting', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', businessId: 'biz1' } as any);
      prisma.workingHours.upsert.mockResolvedValue({} as any);
      const updatedHours = [
        {
          id: 'wh1',
          staffId: 'staff1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '17:00',
          isOff: false,
        },
      ];
      prisma.workingHours.findMany.mockResolvedValue(updatedHours as any);

      const result = await service.setStaffWorkingHours('biz1', 'staff1', [hoursInput[0]]);

      expect(result).toEqual(updatedHours);
    });
  });

  // ─── getStaffTimeOff ──────────────────────────────────────────────────

  describe('getStaffTimeOff', () => {
    it('returns future time-off entries for valid staff', async () => {
      const timeOffs = [
        {
          id: 'to1',
          staffId: 'staff1',
          startDate: new Date('2028-07-01'),
          endDate: new Date('2028-07-05'),
          reason: 'Vacation',
        },
      ];
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', businessId: 'biz1' } as any);
      prisma.timeOff.findMany.mockResolvedValue(timeOffs as any);

      const result = await service.getStaffTimeOff('biz1', 'staff1');

      expect(result).toEqual(timeOffs);
      expect(prisma.timeOff.findMany).toHaveBeenCalledWith({
        where: {
          staffId: 'staff1',
          endDate: { gte: expect.any(Date) },
        },
        orderBy: { startDate: 'asc' },
      });
    });

    it('returns empty array when staff does not belong to business', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      const result = await service.getStaffTimeOff('biz1', 'staff-other');

      expect(result).toEqual([]);
      expect(prisma.timeOff.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── addTimeOff ───────────────────────────────────────────────────────

  describe('addTimeOff', () => {
    it('creates a time-off entry for valid staff', async () => {
      const createdEntry = {
        id: 'to1',
        staffId: 'staff1',
        startDate: new Date('2028-07-01'),
        endDate: new Date('2028-07-05'),
        reason: 'Vacation',
      };
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', businessId: 'biz1' } as any);
      prisma.timeOff.create.mockResolvedValue(createdEntry as any);

      const result = await service.addTimeOff('biz1', 'staff1', {
        startDate: '2028-07-01',
        endDate: '2028-07-05',
        reason: 'Vacation',
      });

      expect(result).toEqual(createdEntry);
      expect(prisma.timeOff.create).toHaveBeenCalledWith({
        data: {
          staffId: 'staff1',
          startDate: new Date('2028-07-01'),
          endDate: new Date('2028-07-05'),
          reason: 'Vacation',
        },
      });
    });

    it('creates time-off without reason', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', businessId: 'biz1' } as any);
      prisma.timeOff.create.mockResolvedValue({ id: 'to1' } as any);

      await service.addTimeOff('biz1', 'staff1', {
        startDate: '2028-07-01',
        endDate: '2028-07-05',
      });

      expect(prisma.timeOff.create).toHaveBeenCalledWith({
        data: {
          staffId: 'staff1',
          startDate: new Date('2028-07-01'),
          endDate: new Date('2028-07-05'),
          reason: undefined,
        },
      });
    });

    it('throws error when staff is not found', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(
        service.addTimeOff('biz1', 'bad-staff', {
          startDate: '2028-07-01',
          endDate: '2028-07-05',
        }),
      ).rejects.toThrow('Staff not found');
    });
  });

  // ─── removeTimeOff ────────────────────────────────────────────────────

  describe('removeTimeOff', () => {
    it('deletes a time-off entry that belongs to the business', async () => {
      prisma.timeOff.findUnique.mockResolvedValue({
        id: 'to1',
        staff: { businessId: 'biz1' },
      } as any);
      prisma.timeOff.delete.mockResolvedValue({ id: 'to1' } as any);

      const result = await service.removeTimeOff('biz1', 'to1');

      expect(result).toEqual({ id: 'to1' });
      expect(prisma.timeOff.delete).toHaveBeenCalledWith({ where: { id: 'to1' } });
    });

    it('throws error when time-off entry is not found', async () => {
      prisma.timeOff.findUnique.mockResolvedValue(null);

      await expect(service.removeTimeOff('biz1', 'bad-id')).rejects.toThrow(
        'Time off entry not found',
      );
    });

    it('throws error when time-off belongs to staff from a different business', async () => {
      prisma.timeOff.findUnique.mockResolvedValue({
        id: 'to1',
        staff: { businessId: 'biz-other' },
      } as any);

      await expect(service.removeTimeOff('biz1', 'to1')).rejects.toThrow(
        'Time off entry not found',
      );
    });

    it('includes staff relation when looking up time-off', async () => {
      prisma.timeOff.findUnique.mockResolvedValue(null);

      try {
        await service.removeTimeOff('biz1', 'to1');
      } catch {
        // expected
      }

      expect(prisma.timeOff.findUnique).toHaveBeenCalledWith({
        where: { id: 'to1' },
        include: { staff: { select: { businessId: true } } },
      });
    });
  });

  describe('getCalendarContext', () => {
    it('returns working hours and time-off for each staff', async () => {
      prisma.staff.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }] as any);
      prisma.workingHours.findMany.mockResolvedValue([
        { staffId: 's1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isOff: false },
        { staffId: 's2', dayOfWeek: 1, startTime: '10:00', endTime: '18:00', isOff: false },
      ] as any);
      prisma.timeOff.findMany.mockResolvedValue([
        {
          staffId: 's1',
          startDate: new Date('2026-03-10'),
          endDate: new Date('2026-03-11'),
          reason: 'Vacation',
        },
      ] as any);

      const result = await service.getCalendarContext(
        'biz1',
        ['s1', 's2'],
        '2026-03-01',
        '2026-03-31',
      );

      expect(result['s1'].workingHours).toHaveLength(1);
      expect(result['s1'].workingHours[0].startTime).toBe('09:00');
      expect(result['s1'].timeOff).toHaveLength(1);
      expect(result['s1'].timeOff[0].reason).toBe('Vacation');
      expect(result['s2'].workingHours).toHaveLength(1);
      expect(result['s2'].timeOff).toHaveLength(0);
    });

    it('only returns data for staff belonging to the business', async () => {
      prisma.staff.findMany.mockResolvedValue([{ id: 's1' }] as any);
      prisma.workingHours.findMany.mockResolvedValue([]);
      prisma.timeOff.findMany.mockResolvedValue([]);

      const result = await service.getCalendarContext(
        'biz1',
        ['s1', 's-invalid'],
        '2026-03-01',
        '2026-03-31',
      );

      expect(result['s1']).toBeDefined();
      expect(result['s-invalid']).toBeUndefined();
    });

    it('queries time-off overlapping the date range', async () => {
      prisma.staff.findMany.mockResolvedValue([{ id: 's1' }] as any);
      prisma.workingHours.findMany.mockResolvedValue([]);
      prisma.timeOff.findMany.mockResolvedValue([]);

      await service.getCalendarContext('biz1', ['s1'], '2026-03-01', '2026-03-07');

      expect(prisma.timeOff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: { lte: new Date('2026-03-07') },
            endDate: { gte: new Date('2026-03-01') },
          }),
        }),
      );
    });

    it('returns empty result for empty staff list', async () => {
      prisma.staff.findMany.mockResolvedValue([]);
      prisma.workingHours.findMany.mockResolvedValue([]);
      prisma.timeOff.findMany.mockResolvedValue([]);

      const result = await service.getCalendarContext('biz1', [], '2026-03-01', '2026-03-31');

      expect(result).toEqual({});
    });
  });

  describe('getRecommendedSlots', () => {
    it('returns top 5 slots sorted by score', async () => {
      // Mock getAvailableSlots dependencies
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 60,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 's1', name: 'Sarah' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 's1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '08:00',
        endTime: '18:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      const result = await service.getRecommendedSlots('biz1', 'svc1', FUTURE_DATE);

      expect(result.length).toBeLessThanOrEqual(5);
      expect(result.length).toBeGreaterThan(0);
      // Each slot should have time, display, staffId, staffName
      expect(result[0]).toHaveProperty('time');
      expect(result[0]).toHaveProperty('display');
      expect(result[0]).toHaveProperty('staffId');
      expect(result[0]).toHaveProperty('staffName');
    });

    it('returns empty when no slots available', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      const result = await service.getRecommendedSlots('biz1', 'svc-bad', FUTURE_DATE);

      expect(result).toEqual([]);
    });

    it('excludes specified booking from conflict check', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        durationMins: 60,
      } as any);
      prisma.staff.findMany.mockResolvedValue([{ id: 's1', name: 'Sarah' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        staffId: 's1',
        dayOfWeek: FUTURE_DATE_DOW,
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      mockCalendarSyncService.pullExternalEvents.mockResolvedValue([]);

      await service.getRecommendedSlots('biz1', 'svc1', FUTURE_DATE, 'exclude-id');

      // The load-balance query should exclude the specified booking
      const loadBalanceCalls = prisma.booking.findMany.mock.calls;
      const lastCall = loadBalanceCalls[loadBalanceCalls.length - 1]?.[0] as any;
      expect(lastCall?.where?.id).toEqual({ not: 'exclude-id' });
    });
  });
});
