import { Test } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { MessagingService } from '../messaging/messaging.service';
import { TemplateService } from '../template/template.service';
import { BusinessService } from '../business/business.service';
import { createMockPrisma } from '../../test/mocks';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { getQueueToken } from '@nestjs/bullmq';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let emailService: any;
  let messagingService: any;
  let templateService: any;
  let businessService: any;
  let mockQueue: any;
  let mockProvider: any;

  const mockBooking = {
    id: 'booking1',
    businessId: 'biz1',
    startTime: new Date('2026-03-01T10:00:00Z'),
    endTime: new Date('2026-03-01T11:00:00Z'),
    customer: {
      id: 'cust1',
      name: 'Jane Doe',
      phone: '+1234567890',
      email: 'jane@example.com',
    },
    service: {
      id: 'svc1',
      name: 'Haircut',
      durationMins: 60,
    },
    staff: {
      id: 'staff1',
      name: 'Sarah Smith',
    },
    business: {
      id: 'biz1',
      name: 'Glow Clinic',
    },
  };

  function createModule(queueAvailable: boolean, withQueue = false) {
    prisma = createMockPrisma();

    mockProvider = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      name: 'mock',
    };

    emailService = {
      send: jest.fn().mockResolvedValue(true),
    };

    messagingService = {
      getProvider: jest.fn().mockReturnValue(mockProvider),
    };

    templateService = {
      resolveVariables: jest.fn().mockImplementation((template) => Promise.resolve(template.body)),
    };

    businessService = {
      findById: jest.fn().mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' }),
      getNotificationSettings: jest
        .fn()
        .mockResolvedValue({ channels: 'both', followUpDelayHours: 2 }),
    };

    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const providers: any[] = [
      NotificationService,
      { provide: PrismaService, useValue: prisma },
      { provide: EmailService, useValue: emailService },
      { provide: MessagingService, useValue: messagingService },
      { provide: TemplateService, useValue: templateService },
      { provide: BusinessService, useValue: businessService },
      { provide: 'QUEUE_AVAILABLE', useValue: queueAvailable },
    ];

    if (withQueue) {
      providers.push({ provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: mockQueue });
    }

    return Test.createTestingModule({ providers }).compile();
  }

  describe('with channels=both and customer has email', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends both WhatsApp and email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Jane Doe'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Booking Confirmed'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });
  });

  describe('with channels=whatsapp', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
      businessService.getNotificationSettings.mockResolvedValue({
        channels: 'whatsapp',
        followUpDelayHours: 2,
      });
    });

    it('sends only WhatsApp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });
  });

  describe('with channels=email and customer has email', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
      businessService.getNotificationSettings.mockResolvedValue({
        channels: 'email',
        followUpDelayHours: 2,
      });
    });

    it('sends only email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Booking Confirmed'),
        html: expect.any(String),
      });
    });
  });

  describe('when customer has no email', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('skips email silently', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      const bookingNoEmail = {
        ...mockBooking,
        customer: { ...mockBooking.customer, email: null },
      };

      await notificationService.sendBookingConfirmation(bookingNoEmail);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });
  });

  describe('template resolution', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('uses resolved template body when template exists', async () => {
      const template = {
        id: 'tpl1',
        body: 'Hello {{customerName}}, your {{serviceName}} is confirmed!',
        variables: ['customerName', 'serviceName'],
        category: 'CONFIRMATION',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hello Jane Doe, your Haircut is confirmed!',
      );

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          serviceName: 'Haircut',
        }),
      );

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: 'Hello Jane Doe, your Haircut is confirmed!',
        businessId: 'biz1',
      });
    });

    it('falls back to default message when no template found', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Jane Doe'),
        businessId: 'biz1',
      });
    });
  });

  describe('email dispatch via queue', () => {
    it('queues email via BullMQ when queue available', async () => {
      const module = await createModule(true, true);
      notificationService = module.get(NotificationService);
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(mockQueue.add).toHaveBeenCalledWith('send-email', {
        to: 'jane@example.com',
        subject: expect.stringContaining('Booking Confirmed'),
        html: expect.any(String),
      });
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends email directly when queue not available', async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(emailService.send).toHaveBeenCalled();
    });
  });
});
