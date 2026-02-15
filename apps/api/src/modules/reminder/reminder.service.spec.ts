import { Test } from '@nestjs/testing';
import { ReminderService } from './reminder.service';
import { PrismaService } from '../../common/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { createMockPrisma } from '../../test/mocks';
import { WhatsAppCloudProvider } from '@booking-os/messaging-provider';

describe('ReminderService', () => {
  let reminderService: ReminderService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let messagingService: jest.Mocked<MessagingService>;
  let mockProvider: any;

  beforeEach(async () => {
    prisma = createMockPrisma();

    mockProvider = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      sendTemplateMessage: jest.fn().mockResolvedValue(undefined),
      name: 'mock',
    };

    messagingService = {
      getProvider: jest.fn().mockReturnValue(mockProvider),
      isWhatsAppCloud: jest.fn().mockReturnValue(false),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ReminderService,
        { provide: PrismaService, useValue: prisma },
        { provide: MessagingService, useValue: messagingService },
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

    it('processes due reminders and marks them as SENT', async () => {
      prisma.reminder.findMany.mockResolvedValue([mockReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(prisma.reminder.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: expect.any(Date) }
        },
        include: {
          booking: {
            include: {
              customer: true,
              service: true,
              staff: true,
              business: true
            },
          },
        },
        take: 50,
      });

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Hi Jane Doe! Reminder: your Haircut is scheduled for'),
        businessId: 'biz1',
      });

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder1' },
        data: { status: 'SENT', sentAt: expect.any(Date) },
      });
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

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
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

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
    });

    it('handles send failure by marking FAILED', async () => {
      prisma.reminder.findMany.mockResolvedValue([mockReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);
      mockProvider.sendMessage.mockRejectedValueOnce(new Error('Send failed'));

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

    it('uses WhatsApp template when isWhatsAppCloud() returns true', async () => {
      const whatsappProvider = new WhatsAppCloudProvider({
        phoneNumberId: 'test-phone',
        accessToken: 'test-token',
      });
      whatsappProvider.sendTemplateMessage = jest.fn().mockResolvedValue(undefined);

      messagingService.isWhatsAppCloud.mockReturnValue(true);
      messagingService.getProvider.mockReturnValue(whatsappProvider as any);

      prisma.reminder.findMany.mockResolvedValue([mockReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(whatsappProvider.sendTemplateMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        templateName: 'appointment_reminder',
        languageCode: 'en',
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: 'Jane Doe' },
            { type: 'text', text: 'Haircut' },
            { type: 'text', text: expect.stringMatching(/\d{1,2}:\d{2}\s?(AM|PM)/i) },
            { type: 'text', text: 'Sarah Smith' },
          ],
        }],
        businessId: 'biz1',
      });

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder1' },
        data: { status: 'SENT', sentAt: expect.any(Date) },
      });
    });

    it('uses plain text when not WhatsApp Cloud', async () => {
      messagingService.isWhatsAppCloud.mockReturnValue(false);

      prisma.reminder.findMany.mockResolvedValue([mockReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringMatching(/Hi Jane Doe! Reminder: your Haircut is scheduled for \d{1,2}:\d{2}\s?(AM|PM) with Sarah Smith at Glow Clinic\. Reply YES to confirm\./),
        businessId: 'biz1',
      });

      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder1' },
        data: { status: 'SENT', sentAt: expect.any(Date) },
      });
    });

    it('handles bookings without staff', async () => {
      const bookingWithoutStaff = { ...mockBooking, staff: null, staffId: null };
      const reminderWithoutStaff = { ...mockReminder, booking: bookingWithoutStaff };

      messagingService.isWhatsAppCloud.mockReturnValue(false);
      prisma.reminder.findMany.mockResolvedValue([reminderWithoutStaff] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringMatching(/Hi Jane Doe! Reminder: your Haircut is scheduled for \d{1,2}:\d{2}\s?(AM|PM) at Glow Clinic\. Reply YES to confirm\./),
        businessId: 'biz1',
      });
    });

    it('handles bookings without staff in WhatsApp template', async () => {
      const bookingWithoutStaff = { ...mockBooking, staff: null, staffId: null };
      const reminderWithoutStaff = { ...mockReminder, booking: bookingWithoutStaff };

      const whatsappProvider = new WhatsAppCloudProvider({
        phoneNumberId: 'test-phone',
        accessToken: 'test-token',
      });
      whatsappProvider.sendTemplateMessage = jest.fn().mockResolvedValue(undefined);

      messagingService.isWhatsAppCloud.mockReturnValue(true);
      messagingService.getProvider.mockReturnValue(whatsappProvider as any);

      prisma.reminder.findMany.mockResolvedValue([reminderWithoutStaff] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(whatsappProvider.sendTemplateMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        templateName: 'appointment_reminder',
        languageCode: 'en',
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: 'Jane Doe' },
            { type: 'text', text: 'Haircut' },
            { type: 'text', text: expect.stringMatching(/\d{1,2}:\d{2}\s?(AM|PM)/i) },
            { type: 'text', text: 'Glow Clinic' },
          ],
        }],
        businessId: 'biz1',
      });
    });

    it('uses defaultLocale from business for WhatsApp template', async () => {
      const businessWithEsLocale = { ...mockBooking.business, defaultLocale: 'es' };
      const bookingWithEsLocale = { ...mockBooking, business: businessWithEsLocale };
      const reminderWithEsLocale = { ...mockReminder, booking: bookingWithEsLocale };

      const whatsappProvider = new WhatsAppCloudProvider({
        phoneNumberId: 'test-phone',
        accessToken: 'test-token',
      });
      whatsappProvider.sendTemplateMessage = jest.fn().mockResolvedValue(undefined);

      messagingService.isWhatsAppCloud.mockReturnValue(true);
      messagingService.getProvider.mockReturnValue(whatsappProvider as any);

      prisma.reminder.findMany.mockResolvedValue([reminderWithEsLocale] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(whatsappProvider.sendTemplateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          languageCode: 'es',
        }),
      );
    });

    it('defaults to "en" locale when business has no defaultLocale', async () => {
      const businessWithoutLocale = { ...mockBooking.business, defaultLocale: null };
      const bookingWithoutLocale = { ...mockBooking, business: businessWithoutLocale };
      const reminderWithoutLocale = { ...mockReminder, booking: bookingWithoutLocale };

      const whatsappProvider = new WhatsAppCloudProvider({
        phoneNumberId: 'test-phone',
        accessToken: 'test-token',
      });
      whatsappProvider.sendTemplateMessage = jest.fn().mockResolvedValue(undefined);

      messagingService.isWhatsAppCloud.mockReturnValue(true);
      messagingService.getProvider.mockReturnValue(whatsappProvider as any);

      prisma.reminder.findMany.mockResolvedValue([reminderWithoutLocale] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(whatsappProvider.sendTemplateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          languageCode: 'en',
        }),
      );
    });

    it('handles empty results gracefully', async () => {
      prisma.reminder.findMany.mockResolvedValue([]);

      await reminderService.processPendingReminders();

      expect(prisma.reminder.findMany).toHaveBeenCalled();
      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
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

      expect(mockProvider.sendMessage).toHaveBeenCalledTimes(2);
      expect(prisma.reminder.update).toHaveBeenCalledTimes(2);

      expect(mockProvider.sendMessage).toHaveBeenNthCalledWith(1, {
        to: '+1234567890',
        body: expect.stringContaining('Jane Doe'),
        businessId: 'biz1',
      });

      expect(mockProvider.sendMessage).toHaveBeenNthCalledWith(2, {
        to: '+0987654321',
        body: expect.stringContaining('John Smith'),
        businessId: 'biz1',
      });
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

      mockProvider.sendMessage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      await reminderService.processPendingReminders();

      expect(mockProvider.sendMessage).toHaveBeenCalledTimes(2);
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

    it('formats time correctly for different times of day', async () => {
      const morningBooking = {
        ...mockBooking,
        startTime: new Date('2026-03-01T09:30:00Z')
      };
      const afternoonBooking = {
        ...mockBooking,
        startTime: new Date('2026-03-01T14:45:00Z')
      };

      const morningReminder = { ...mockReminder, booking: morningBooking };
      const afternoonReminder = {
        ...mockReminder,
        id: 'reminder2',
        booking: afternoonBooking
      };

      prisma.reminder.findMany.mockResolvedValue([morningReminder, afternoonReminder] as any);
      prisma.reminder.update.mockResolvedValue({} as any);

      await reminderService.processPendingReminders();

      expect(mockProvider.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringMatching(/scheduled for \d{1,2}:\d{2}\s?(AM|PM)/i),
        }),
      );

      expect(mockProvider.sendMessage).toHaveBeenCalledTimes(2);
    });
  });
});
