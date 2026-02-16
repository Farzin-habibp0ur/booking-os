import { Test } from '@nestjs/testing';
import { ReminderService } from './reminder.service';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { createMockPrisma, createMockNotificationService } from '../../test/mocks';

describe('ReminderService', () => {
  let reminderService: ReminderService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockNotificationService = createMockNotificationService();

    const module = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    reminderService = module.get(ReminderService);
  });

  describe('processPendingReminders', () => {
    const mockBooking = {
      id: 'booking1',
      businessId: 'biz1',
      customerId: 'cust1',
      serviceId: 'svc1',
      staffId: 'staff1',
      status: 'CONFIRMED',
      startTime: new Date('2026-03-01T10:00:00Z'),
      endTime: new Date('2026-03-01T11:00:00Z'),
      customer: {
        id: 'cust1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
      },
      service: {
        id: 'svc1',
        name: 'Haircut',
        durationMins: 60,
      },
      staff: {
        id: 'staff1',
        name: 'Sarah Smith',
        email: 'sarah@example.com',
      },
      business: {
        id: 'biz1',
        name: 'Glow Clinic',
        defaultLocale: 'en',
      },
    };

    const mockReminder = {
      id: 'reminder1',
      bookingId: 'booking1',
      status: 'PENDING',
      scheduledAt: new Date('2026-02-28T10:00:00Z'),
      sentAt: null,
      booking: mockBooking,
    };

    it('processes due reminders via NotificationService and marks them as SENT', async () => {
      prisma.reminder.findMany.mockResolvedValue([mockReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(mockNotificationService.sendReminder).toHaveBeenCalledWith(mockBooking);

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder1' },
        data: { status: 'SENT', sentAt: expect.any(Date) },
      });
    });

    it('routes FOLLOW_UP type through sendFollowUp', async () => {
      const followUpReminder = { ...mockReminder, type: 'FOLLOW_UP' };
      prisma.reminder.findMany.mockResolvedValue([followUpReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(mockNotificationService.sendFollowUp).toHaveBeenCalledWith(mockBooking);
      expect(mockNotificationService.sendReminder).not.toHaveBeenCalled();
    });

    it('routes REMINDER type through sendReminder', async () => {
      const reminderType = { ...mockReminder, type: 'REMINDER' };
      prisma.reminder.findMany.mockResolvedValue([reminderType] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(mockNotificationService.sendReminder).toHaveBeenCalledWith(mockBooking);
      expect(mockNotificationService.sendFollowUp).not.toHaveBeenCalled();
    });

    it('defaults to sendReminder when type is not set', async () => {
      // No type field on the reminder
      prisma.reminder.findMany.mockResolvedValue([mockReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(mockNotificationService.sendReminder).toHaveBeenCalledWith(mockBooking);
    });

    it('cancels reminders for CANCELLED bookings', async () => {
      const cancelledBooking = { ...mockBooking, status: 'CANCELLED' };
      const cancelledReminder = { ...mockReminder, booking: cancelledBooking };

      prisma.reminder.findMany.mockResolvedValue([cancelledReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder1' },
        data: { status: 'CANCELLED' },
      });

      expect(mockNotificationService.sendReminder).not.toHaveBeenCalled();
      expect(mockNotificationService.sendFollowUp).not.toHaveBeenCalled();
    });

    it('cancels reminders for NO_SHOW bookings', async () => {
      const noShowBooking = { ...mockBooking, status: 'NO_SHOW' };
      const noShowReminder = { ...mockReminder, booking: noShowBooking };

      prisma.reminder.findMany.mockResolvedValue([noShowReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder1' },
        data: { status: 'CANCELLED' },
      });

      expect(mockNotificationService.sendReminder).not.toHaveBeenCalled();
    });

    it('handles send failure by marking FAILED', async () => {
      prisma.reminder.findMany.mockResolvedValue([mockReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);
      mockNotificationService.sendReminder.mockRejectedValueOnce(new Error('Send failed'));

      await reminderService.processPendingReminders();

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder1' },
        data: { status: 'FAILED' },
      });
    });

    it('only processes reminders with status PENDING and scheduledAt <= now', async () => {
      prisma.reminder.findMany.mockResolvedValue([]);

      await reminderService.processPendingReminders();

      expect(prisma.reminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'PENDING',
            scheduledAt: { lte: expect.any(Date) },
          },
        }),
      );
    });

    it('handles empty results gracefully', async () => {
      prisma.reminder.findMany.mockResolvedValue([]);

      await reminderService.processPendingReminders();

      expect(prisma.reminder.findMany).toHaveBeenCalled();
      expect(mockNotificationService.sendReminder).not.toHaveBeenCalled();
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });

    it('processes multiple reminders in batch', async () => {
      const reminder2 = {
        ...mockReminder,
        id: 'reminder2',
        bookingId: 'booking2',
        booking: {
          ...mockBooking,
          id: 'booking2',
          customer: { ...mockBooking.customer, name: 'John Smith', phone: '+0987654321' },
        },
      };

      prisma.reminder.findMany.mockResolvedValue([mockReminder, reminder2] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(mockNotificationService.sendReminder).toHaveBeenCalledTimes(2);
      expect(prisma.reminder.update).toHaveBeenCalledTimes(2);
    });

    it('continues processing remaining reminders if one fails', async () => {
      const reminder2 = {
        ...mockReminder,
        id: 'reminder2',
        bookingId: 'booking2',
        booking: {
          ...mockBooking,
          id: 'booking2',
          customer: { ...mockBooking.customer, name: 'John Smith', phone: '+0987654321' },
        },
      };

      prisma.reminder.findMany.mockResolvedValue([mockReminder, reminder2] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      mockNotificationService.sendReminder
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      await reminderService.processPendingReminders();

      expect(mockNotificationService.sendReminder).toHaveBeenCalledTimes(2);
      expect(prisma.reminder.update).toHaveBeenCalledTimes(2);

      expect(prisma.reminder.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'reminder1' },
        data: { status: 'FAILED' },
      });

      expect(prisma.reminder.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'reminder2' },
        data: { status: 'SENT', sentAt: expect.any(Date) },
      });
    });

    it('limits query to 50 reminders', async () => {
      prisma.reminder.findMany.mockResolvedValue([]);

      await reminderService.processPendingReminders();

      expect(prisma.reminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    describe('CONSULT_FOLLOW_UP handling', () => {
      const consultBooking = {
        ...mockBooking,
        id: 'booking-consult',
        customerId: 'cust1',
        updatedAt: new Date('2026-02-15T10:00:00Z'),
        service: { id: 'svc-consult', name: 'Consultation', durationMins: 20, kind: 'CONSULT' },
      };

      const consultReminder = {
        ...mockReminder,
        id: 'reminder-consult',
        type: 'CONSULT_FOLLOW_UP',
        booking: consultBooking,
      };

      it('cancels CONSULT_FOLLOW_UP when customer already has a TREATMENT booking', async () => {
        prisma.reminder.findMany.mockResolvedValue([consultReminder] as any);
        prisma.booking.findFirst.mockResolvedValue({ id: 'treatment-booking' } as any);
        prisma.reminder.update.mockResolvedValue({} as any);

        await reminderService.processPendingReminders();

        expect(prisma.booking.findFirst).toHaveBeenCalledWith({
          where: {
            customerId: 'cust1',
            businessId: 'biz1',
            service: { kind: 'TREATMENT' },
            createdAt: { gte: consultBooking.updatedAt },
          },
        });
        expect(prisma.reminder.update).toHaveBeenCalledWith({
          where: { id: 'reminder-consult' },
          data: { status: 'CANCELLED' },
        });
        expect(mockNotificationService.sendConsultFollowUp).not.toHaveBeenCalled();
      });

      it('cancels CONSULT_FOLLOW_UP when customer opted out', async () => {
        prisma.reminder.findMany.mockResolvedValue([consultReminder] as any);
        prisma.booking.findFirst.mockResolvedValue(null); // no treatment booking
        prisma.customer.findUnique.mockResolvedValue({
          id: 'cust1',
          customFields: { consultFollowUpOptOut: true },
        } as any);
        prisma.reminder.update.mockResolvedValue({} as any);

        await reminderService.processPendingReminders();

        expect(prisma.reminder.update).toHaveBeenCalledWith({
          where: { id: 'reminder-consult' },
          data: { status: 'CANCELLED' },
        });
        expect(mockNotificationService.sendConsultFollowUp).not.toHaveBeenCalled();
      });

      it('sends CONSULT_FOLLOW_UP when no treatment exists and no opt-out', async () => {
        prisma.reminder.findMany.mockResolvedValue([consultReminder] as any);
        prisma.booking.findFirst.mockResolvedValue(null); // no treatment booking
        prisma.customer.findUnique.mockResolvedValue({
          id: 'cust1',
          customFields: {},
        } as any);
        prisma.reminder.update.mockResolvedValue({} as any);

        await reminderService.processPendingReminders();

        expect(mockNotificationService.sendConsultFollowUp).toHaveBeenCalledWith(consultBooking);
        expect(prisma.reminder.update).toHaveBeenCalledWith({
          where: { id: 'reminder-consult' },
          data: { status: 'SENT', sentAt: expect.any(Date) },
        });
      });

      it('marks CONSULT_FOLLOW_UP as FAILED when send throws', async () => {
        prisma.reminder.findMany.mockResolvedValue([consultReminder] as any);
        prisma.booking.findFirst.mockResolvedValue(null);
        prisma.customer.findUnique.mockResolvedValue({
          id: 'cust1',
          customFields: {},
        } as any);
        prisma.reminder.update.mockResolvedValue({} as any);
        mockNotificationService.sendConsultFollowUp.mockRejectedValueOnce(
          new Error('Send failed'),
        );

        await reminderService.processPendingReminders();

        expect(prisma.reminder.update).toHaveBeenCalledWith({
          where: { id: 'reminder-consult' },
          data: { status: 'FAILED' },
        });
      });
    });
  });
});
