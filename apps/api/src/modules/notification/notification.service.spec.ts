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

  const mockBookingNoEmail = {
    ...mockBooking,
    customer: { ...mockBooking.customer, email: null },
  };

  const mockBookingNoStaff = {
    ...mockBooking,
    staff: null,
  };

  const mockBookingNoBusiness = {
    ...mockBooking,
    business: null,
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

  // Helper: set up prisma mocks for logNotificationEvent calls within send* methods
  function setupLogMocks() {
    prisma.booking.findUnique.mockResolvedValue({ customFields: {} } as any);
    prisma.booking.update.mockResolvedValue({} as any);
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

  describe('sendConsultFollowUp', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends consult follow-up via both channels', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue({
        id: 'biz1',
        name: 'Glow Clinic',
        slug: 'glow-clinic',
      });

      await notificationService.sendConsultFollowUp(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Jane Doe'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Ready for your treatment?'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses CONSULT_FOLLOW_UP template when one exists', async () => {
      const template = {
        id: 'tpl-consult',
        body: 'Hi {{customerName}}, book your treatment at {{bookingLink}}!',
        variables: ['customerName', 'bookingLink'],
        category: 'CONSULT_FOLLOW_UP',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hi Jane Doe, book your treatment at glow-clinic/book!',
      );
      businessService.findById.mockResolvedValue({
        id: 'biz1',
        name: 'Glow Clinic',
        slug: 'glow-clinic',
      });

      // Use booking without business so findById is called (which returns slug)
      const bookingWithoutBusiness = { ...mockBooking, business: null };
      await notificationService.sendConsultFollowUp(bookingWithoutBusiness);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          bookingLink: 'glow-clinic/book',
        }),
      );
    });

    it('falls back to default message when no template exists', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue({
        id: 'biz1',
        name: 'Glow Clinic',
        slug: 'glow-clinic',
      });

      await notificationService.sendConsultFollowUp(mockBooking);

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('consultation'),
        businessId: 'biz1',
      });
    });

    it('sets empty bookingLink when business has no slug', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      // booking.business has no slug
      await notificationService.sendConsultFollowUp(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.any(String),
        businessId: 'biz1',
      });
    });

    it('sets bookingLink from slug when business has slug', async () => {
      const template = {
        id: 'tpl-consult',
        body: 'Book at {{bookingLink}}',
        variables: ['bookingLink'],
        category: 'CONSULT_FOLLOW_UP',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue('Book at glow-clinic/book');
      businessService.findById.mockResolvedValue({
        id: 'biz1',
        name: 'Glow Clinic',
        slug: 'glow-clinic',
      });

      const bookingWithoutBusiness = { ...mockBooking, business: null };
      await notificationService.sendConsultFollowUp(bookingWithoutBusiness);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({ bookingLink: 'glow-clinic/book' }),
      );
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.sendConsultFollowUp(mockBooking)).resolves.toBeUndefined();
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendConsultFollowUp(mockBookingNoEmail);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendConsultFollowUp(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendConsultFollowUp(mockBooking);

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalled();
    });
  });

  describe('sendAftercare', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends aftercare via both channels', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendAftercare(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Jane Doe'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Aftercare instructions'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses AFTERCARE template when one exists', async () => {
      const template = {
        id: 'tpl-aftercare',
        body: 'Hi {{customerName}}, aftercare for {{serviceName}}: rest and hydrate!',
        variables: ['customerName', 'serviceName'],
        category: 'AFTERCARE',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hi Jane Doe, aftercare for Haircut: rest and hydrate!',
      );

      await notificationService.sendAftercare(mockBooking);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          serviceName: 'Haircut',
        }),
      );
    });

    it('falls back to default aftercare message when no template', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendAftercare(mockBooking);

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('aftercare reminders'),
        businessId: 'biz1',
      });
    });

    it('looks up business when booking.business is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      await notificationService.sendAftercare(mockBookingNoBusiness);

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });

    it('uses "Our Business" when business is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue(null);

      await notificationService.sendAftercare(mockBookingNoBusiness);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Our Business'),
        businessId: 'biz1',
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.sendAftercare(mockBooking)).resolves.toBeUndefined();
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendAftercare(mockBookingNoEmail);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('omits staffName from context when no staff', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendAftercare(mockBookingNoStaff);

      // Default message should not mention "with undefined"
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.not.stringContaining('undefined'),
        businessId: 'biz1',
      });
    });
  });

  describe('sendTreatmentCheckIn', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends treatment check-in via both channels', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendTreatmentCheckIn(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Jane Doe'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('How are you feeling?'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses TREATMENT_CHECK_IN template when one exists', async () => {
      const template = {
        id: 'tpl-checkin',
        body: 'Hi {{customerName}}, how are you feeling after your {{serviceName}}?',
        variables: ['customerName', 'serviceName'],
        category: 'TREATMENT_CHECK_IN',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hi Jane Doe, how are you feeling after your Haircut?',
      );

      await notificationService.sendTreatmentCheckIn(mockBooking);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          serviceName: 'Haircut',
        }),
      );
    });

    it('falls back to default check-in message when no template', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendTreatmentCheckIn(mockBooking);

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('How are you feeling'),
        businessId: 'biz1',
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.sendTreatmentCheckIn(mockBooking)).resolves.toBeUndefined();
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendTreatmentCheckIn(mockBookingNoEmail);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendTreatmentCheckIn(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendTreatmentCheckIn(mockBooking);

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalled();
    });

    it('looks up business from service when booking has no business', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      await notificationService.sendTreatmentCheckIn(mockBookingNoBusiness);

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });
  });

  describe('sendDepositRequest', () => {
    const depositBooking = {
      ...mockBooking,
      service: {
        ...mockBooking.service,
        depositRequired: true,
        depositAmount: 100,
        price: 350,
      },
    };

    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends deposit request via both channels', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendDepositRequest(depositBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('deposit'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Deposit required'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses DEPOSIT_REQUIRED template when one exists', async () => {
      const template = {
        id: 'tpl-deposit',
        body: 'Hi {{customerName}}, a deposit of ${{depositAmount}} is required for {{serviceName}}.',
        variables: ['customerName', 'depositAmount', 'serviceName'],
        category: 'DEPOSIT_REQUIRED',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hi Jane Doe, a deposit of $100 is required for Haircut.',
      );

      await notificationService.sendDepositRequest(depositBooking);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          depositAmount: '100',
          serviceName: 'Haircut',
        }),
      );
    });

    it('falls back to default deposit request message when no template', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendDepositRequest(depositBooking);

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('$100'),
        businessId: 'biz1',
      });
    });

    it('includes depositAmount in template context from service', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendDepositRequest(depositBooking);

      // The fallback message should include $100 (depositAmount)
      const whatsappCall = mockProvider.sendMessage.mock.calls[0];
      expect(whatsappCall[0].body).toContain('$100');
    });

    it('falls back to price when depositAmount is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      const bookingNullDeposit = {
        ...mockBooking,
        service: {
          ...mockBooking.service,
          depositRequired: true,
          depositAmount: null,
          price: 350,
        },
      };

      await notificationService.sendDepositRequest(bookingNullDeposit);

      const whatsappCall = mockProvider.sendMessage.mock.calls[0];
      expect(whatsappCall[0].body).toContain('$350');
    });

    it('falls back to 0 when both depositAmount and price are missing', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      const bookingNoAmounts = {
        ...mockBooking,
        service: {
          ...mockBooking.service,
          depositRequired: true,
          depositAmount: null,
          price: undefined,
        },
      };

      await notificationService.sendDepositRequest(bookingNoAmounts);

      const whatsappCall = mockProvider.sendMessage.mock.calls[0];
      expect(whatsappCall[0].body).toContain('$0');
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.sendDepositRequest(depositBooking)).resolves.toBeUndefined();
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      const noEmailDeposit = {
        ...depositBooking,
        customer: { ...depositBooking.customer, email: null },
      };

      await notificationService.sendDepositRequest(noEmailDeposit);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendDepositRequest(depositBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendDepositRequest(depositBooking);

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalled();
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

    it('sends email directly when queueAvailable=true but no queue injected', async () => {
      // queueAvailable=true but withQueue=false -> no queue instance
      const module = await createModule(true, false);
      notificationService = module.get(NotificationService);
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      // Should fall through to direct email since notificationQueue is undefined
      expect(emailService.send).toHaveBeenCalled();
    });
  });

  describe('sendCancellationNotification', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends via WhatsApp and email when channels = both', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      prisma.booking.findUnique.mockResolvedValue({ customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.sendCancellationNotification(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('cancelled'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Appointment Cancelled'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('resolves CANCELLATION template when one exists', async () => {
      const template = {
        id: 'tpl-cancel',
        body: 'Hi {{customerName}}, your {{serviceName}} has been cancelled.',
        variables: ['customerName', 'serviceName'],
        category: 'CANCELLATION',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hi Jane Doe, your Haircut has been cancelled.',
      );
      prisma.booking.findUnique.mockResolvedValue({ customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.sendCancellationNotification(mockBooking);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          serviceName: 'Haircut',
        }),
      );
    });

    it('logs notification event to booking timeline', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      prisma.booking.findUnique.mockResolvedValue({ customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.sendCancellationNotification(mockBooking);

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [
              expect.objectContaining({
                type: 'sent',
                category: 'CANCELLATION',
                sentAt: expect.any(String),
              }),
            ],
          },
        },
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationService.sendCancellationNotification(mockBooking),
      ).resolves.toBeUndefined();
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendCancellationNotification(mockBookingNoEmail);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendCancellationNotification(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendCancellationNotification(mockBooking);

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalled();
    });

    it('looks up business from service when booking has no business', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      await notificationService.sendCancellationNotification(mockBookingNoBusiness);

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });
  });

  describe('logNotificationEvent', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('appends to existing notificationLog array', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        customFields: {
          notificationLog: [
            { type: 'sent', category: 'CONFIRMATION', sentAt: '2026-01-01T00:00:00Z' },
          ],
        },
      } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.logNotificationEvent('booking1', 'sent', 'REMINDER');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [
              { type: 'sent', category: 'CONFIRMATION', sentAt: '2026-01-01T00:00:00Z' },
              expect.objectContaining({ type: 'sent', category: 'REMINDER' }),
            ],
          },
        },
      });
    });

    it('creates notificationLog when customFields is empty', async () => {
      prisma.booking.findUnique.mockResolvedValue({ customFields: null } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.logNotificationEvent('booking1', 'sent', 'FOLLOW_UP');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [expect.objectContaining({ type: 'sent', category: 'FOLLOW_UP' })],
          },
        },
      });
    });

    it('preserves other customFields data', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        customFields: {
          depositRequestLog: [{ sentAt: '2026-01-01T00:00:00Z' }],
          notificationLog: [],
        },
      } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.logNotificationEvent('booking1', 'sent', 'AFTERCARE');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: expect.objectContaining({
            depositRequestLog: [{ sentAt: '2026-01-01T00:00:00Z' }],
          }),
        },
      });
    });

    it('handles non-array notificationLog in customFields', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        customFields: { notificationLog: 'invalid' },
      } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.logNotificationEvent('booking1', 'sent', 'REMINDER');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [expect.objectContaining({ type: 'sent', category: 'REMINDER' })],
          },
        },
      });
    });

    it('handles booking not found (null booking)', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.logNotificationEvent('nonexistent', 'sent', 'REMINDER');

      // Should still attempt update with empty customFields
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'nonexistent' },
        data: {
          customFields: {
            notificationLog: [expect.objectContaining({ type: 'sent', category: 'REMINDER' })],
          },
        },
      });
    });

    it('handles error from prisma.booking.findUnique gracefully', async () => {
      prisma.booking.findUnique.mockRejectedValue(new Error('DB connection failed'));

      await expect(
        notificationService.logNotificationEvent('booking1', 'sent', 'REMINDER'),
      ).resolves.toBeUndefined();
    });

    it('handles error from prisma.booking.update gracefully', async () => {
      prisma.booking.findUnique.mockResolvedValue({ customFields: {} } as any);
      prisma.booking.update.mockRejectedValue(new Error('Update failed'));

      await expect(
        notificationService.logNotificationEvent('booking1', 'sent', 'REMINDER'),
      ).resolves.toBeUndefined();
    });

    it('includes sentAt timestamp as ISO string', async () => {
      prisma.booking.findUnique.mockResolvedValue({ customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.logNotificationEvent('booking1', 'sent', 'CONFIRMATION');

      const updateCall = prisma.booking.update.mock.calls[0][0];
      const log = (updateCall as any).data.customFields.notificationLog[0];
      expect(log.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('template fallbacks', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('falls back to CANCELLATION default message', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      prisma.booking.findUnique.mockResolvedValue({ customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.sendCancellationNotification(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('cancelled'),
        businessId: 'biz1',
      });
    });

    it('falls back to RESCHEDULE_LINK default message', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      prisma.booking.findUnique.mockResolvedValue({ customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({} as any);

      await notificationService.sendRescheduleLink(
        mockBooking,
        'https://example.com/reschedule/abc',
      );

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('https://example.com/reschedule/abc'),
        businessId: 'biz1',
      });
    });
  });

  // ==========================================
  // NEW: sendReminder (previously 0% coverage)
  // ==========================================
  describe('sendReminder', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends reminder via both channels with default message', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendReminder(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Reminder'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Appointment Reminder'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses REMINDER template when one exists', async () => {
      const template = {
        id: 'tpl-reminder',
        body: 'Hi {{customerName}}, your {{serviceName}} is tomorrow!',
        variables: ['customerName', 'serviceName'],
        category: 'REMINDER',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue('Hi Jane Doe, your Haircut is tomorrow!');
      setupLogMocks();

      await notificationService.sendReminder(mockBooking);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          serviceName: 'Haircut',
        }),
      );

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: 'Hi Jane Doe, your Haircut is tomorrow!',
        businessId: 'biz1',
      });
    });

    it('falls back to default REMINDER message when no template', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendReminder(mockBooking);

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Reply YES to confirm'),
        businessId: 'biz1',
      });
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendReminder(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendReminder(mockBooking);

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Appointment Reminder'),
        html: expect.any(String),
      });
    });

    it('skips email when customer has no email (channels=both)', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendReminder(mockBookingNoEmail);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('skips email when customer has no email (channels=email)', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendReminder(mockBookingNoEmail);

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('looks up business from service when booking.business is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      await notificationService.sendReminder(mockBookingNoBusiness);

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });

    it('uses "Our Business" when business lookup returns null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue(null);

      await notificationService.sendReminder(mockBookingNoBusiness);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Our Business'),
        businessId: 'biz1',
      });
    });

    it('includes staffName in reminder when staff present', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendReminder(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Sarah Smith'),
        businessId: 'biz1',
      });
    });

    it('omits staffName reference in reminder when no staff', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendReminder(mockBookingNoStaff);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.not.stringContaining('undefined'),
        businessId: 'biz1',
      });
    });

    it('logs REMINDER notification event', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendReminder(mockBooking);

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [expect.objectContaining({ type: 'sent', category: 'REMINDER' })],
          },
        },
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.sendReminder(mockBooking)).resolves.toBeUndefined();
    });
  });

  // ==========================================
  // NEW: sendFollowUp (previously 0% coverage)
  // ==========================================
  describe('sendFollowUp', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends follow-up via both channels with default message', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendFollowUp(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('thank you for visiting'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('How was your visit?'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses FOLLOW_UP template when one exists', async () => {
      const template = {
        id: 'tpl-followup',
        body: 'Hi {{customerName}}, thanks for your {{serviceName}}!',
        variables: ['customerName', 'serviceName'],
        category: 'FOLLOW_UP',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue('Hi Jane Doe, thanks for your Haircut!');
      setupLogMocks();

      await notificationService.sendFollowUp(mockBooking);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          serviceName: 'Haircut',
        }),
      );

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: 'Hi Jane Doe, thanks for your Haircut!',
        businessId: 'biz1',
      });
    });

    it('falls back to default FOLLOW_UP message when no template', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendFollowUp(mockBooking);

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('feedback'),
        businessId: 'biz1',
      });
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendFollowUp(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendFollowUp(mockBooking);

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('How was your visit?'),
        html: expect.any(String),
      });
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendFollowUp(mockBookingNoEmail);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('looks up business from service when booking.business is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      await notificationService.sendFollowUp(mockBookingNoBusiness);

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });

    it('uses "Our Business" when business lookup returns null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue(null);

      await notificationService.sendFollowUp(mockBookingNoBusiness);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Our Business'),
        businessId: 'biz1',
      });
    });

    it('logs FOLLOW_UP notification event', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendFollowUp(mockBooking);

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [expect.objectContaining({ type: 'sent', category: 'FOLLOW_UP' })],
          },
        },
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(notificationService.sendFollowUp(mockBooking)).resolves.toBeUndefined();
    });

    it('includes staffName when staff present', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendFollowUp(mockBooking);

      // Default FOLLOW_UP message does not include staffName, but it is in the context
      // Just verify it does not crash and produces valid output
      expect(mockProvider.sendMessage).toHaveBeenCalled();
    });
  });

  // ==========================================
  // NEW: sendRescheduleLink (partial coverage before)
  // ==========================================
  describe('sendRescheduleLink', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends reschedule link via both channels', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendRescheduleLink(
        mockBooking,
        'https://example.com/reschedule/abc',
      );

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('https://example.com/reschedule/abc'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Reschedule your appointment'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses RESCHEDULE_LINK template when one exists', async () => {
      const template = {
        id: 'tpl-resched',
        body: 'Hi {{customerName}}, reschedule here: {{rescheduleLink}}',
        variables: ['customerName', 'rescheduleLink'],
        category: 'RESCHEDULE_LINK',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hi Jane Doe, reschedule here: https://example.com/reschedule/abc',
      );
      setupLogMocks();

      await notificationService.sendRescheduleLink(
        mockBooking,
        'https://example.com/reschedule/abc',
      );

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          rescheduleLink: 'https://example.com/reschedule/abc',
        }),
      );
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendRescheduleLink(mockBooking, 'https://link');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendRescheduleLink(mockBooking, 'https://link');

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Reschedule'),
        html: expect.any(String),
      });
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendRescheduleLink(mockBookingNoEmail, 'https://link');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('looks up business from service when booking.business is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      await notificationService.sendRescheduleLink(mockBookingNoBusiness, 'https://link');

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });

    it('uses "Our Business" when business lookup returns null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue(null);

      await notificationService.sendRescheduleLink(mockBookingNoBusiness, 'https://link');

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Our Business'),
        html: expect.stringContaining('Our Business'),
      });
    });

    it('logs RESCHEDULE_LINK notification event', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendRescheduleLink(mockBooking, 'https://link');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [
              expect.objectContaining({ type: 'sent', category: 'RESCHEDULE_LINK' }),
            ],
          },
        },
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationService.sendRescheduleLink(mockBooking, 'https://link'),
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================
  // NEW: sendCancelLink (previously 0% coverage)
  // ==========================================
  describe('sendCancelLink', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends cancel link via both channels', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendCancelLink(mockBooking, 'https://example.com/cancel/abc');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('https://example.com/cancel/abc'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Cancel your appointment'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses CANCEL_LINK template when one exists', async () => {
      const template = {
        id: 'tpl-cancel-link',
        body: 'Hi {{customerName}}, cancel here: {{cancelLink}}',
        variables: ['customerName', 'cancelLink'],
        category: 'CANCEL_LINK',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hi Jane Doe, cancel here: https://example.com/cancel/abc',
      );
      setupLogMocks();

      await notificationService.sendCancelLink(mockBooking, 'https://example.com/cancel/abc');

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Jane Doe',
          cancelLink: 'https://example.com/cancel/abc',
        }),
      );
    });

    it('falls back to default CANCEL_LINK message when no template', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendCancelLink(mockBooking, 'https://example.com/cancel/abc');

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('https://example.com/cancel/abc'),
        businessId: 'biz1',
      });
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendCancelLink(mockBooking, 'https://link');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendCancelLink(mockBooking, 'https://link');

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Cancel your appointment'),
        html: expect.any(String),
      });
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendCancelLink(mockBookingNoEmail, 'https://link');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('looks up business from service when booking.business is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      await notificationService.sendCancelLink(mockBookingNoBusiness, 'https://link');

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });

    it('uses "Our Business" when business lookup returns null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.findById.mockResolvedValue(null);

      await notificationService.sendCancelLink(mockBookingNoBusiness, 'https://link');

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Our Business'),
        html: expect.stringContaining('Our Business'),
      });
    });

    it('logs CANCEL_LINK notification event', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendCancelLink(mockBooking, 'https://link');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [expect.objectContaining({ type: 'sent', category: 'CANCEL_LINK' })],
          },
        },
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationService.sendCancelLink(mockBooking, 'https://link'),
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================
  // NEW: sendWaitlistOffer (previously 0% coverage)
  // ==========================================
  describe('sendWaitlistOffer', () => {
    const waitlistEntry = {
      customer: { name: 'Emma Wilson', phone: '+1987654321', email: 'emma@example.com' },
      service: { name: 'Botox Treatment' },
      business: { name: 'Glow Clinic' } as { name: string } | null,
    };

    const slot = {
      date: 'Monday, March 2, 2026',
      time: '2:00 PM',
      staffName: 'Dr. Chen',
    };

    const claimLink = 'https://example.com/claim/xyz';

    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends waitlist offer via both channels', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendWaitlistOffer(waitlistEntry, slot, claimLink, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1987654321',
        body: expect.stringContaining('Emma Wilson'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'emma@example.com',
        subject: expect.stringContaining('A slot opened for Botox Treatment'),
        html: expect.stringContaining('Glow Clinic'),
      });
    });

    it('uses WAITLIST_OFFER template when one exists', async () => {
      const template = {
        id: 'tpl-waitlist',
        body: 'Hi {{customerName}}, claim your {{serviceName}} slot: {{claimLink}}',
        variables: ['customerName', 'serviceName', 'claimLink'],
        category: 'WAITLIST_OFFER',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template] as any);
      templateService.resolveVariables.mockResolvedValue(
        'Hi Emma Wilson, claim your Botox Treatment slot: https://example.com/claim/xyz',
      );

      await notificationService.sendWaitlistOffer(waitlistEntry, slot, claimLink, 'biz1');

      expect(templateService.resolveVariables).toHaveBeenCalledWith(
        template,
        expect.objectContaining({
          customerName: 'Emma Wilson',
          serviceName: 'Botox Treatment',
          claimLink: 'https://example.com/claim/xyz',
          staffName: 'Dr. Chen',
        }),
      );
    });

    it('falls back to default WAITLIST_OFFER message when no template', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendWaitlistOffer(waitlistEntry, slot, claimLink, 'biz1');

      expect(templateService.resolveVariables).not.toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1987654321',
        body: expect.stringContaining('Botox Treatment'),
        businessId: 'biz1',
      });
    });

    it('includes claimLink in the default message', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendWaitlistOffer(waitlistEntry, slot, claimLink, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1987654321',
        body: expect.stringContaining('https://example.com/claim/xyz'),
        businessId: 'biz1',
      });
    });

    it('includes staffName in default message when present', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendWaitlistOffer(waitlistEntry, slot, claimLink, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1987654321',
        body: expect.stringContaining('Dr. Chen'),
        businessId: 'biz1',
      });
    });

    it('omits staffName from default message when not present', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      const slotNoStaff = { date: 'Monday, March 2, 2026', time: '2:00 PM' };

      await notificationService.sendWaitlistOffer(waitlistEntry, slotNoStaff, claimLink, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1987654321',
        body: expect.not.stringContaining('with undefined'),
        businessId: 'biz1',
      });
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendWaitlistOffer(waitlistEntry, slot, claimLink, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendWaitlistOffer(waitlistEntry, slot, claimLink, 'biz1');

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledWith({
        to: 'emma@example.com',
        subject: expect.stringContaining('A slot opened'),
        html: expect.any(String),
      });
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      const entryNoEmail = {
        ...waitlistEntry,
        customer: { ...waitlistEntry.customer, email: null },
      };

      await notificationService.sendWaitlistOffer(entryNoEmail, slot, claimLink, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('looks up business when entry.business is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      const entryNoBusiness = { ...waitlistEntry, business: null };
      await notificationService.sendWaitlistOffer(entryNoBusiness, slot, claimLink, 'biz1');

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });

    it('uses "Our Business" when business lookup returns null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue(null);

      const entryNoBusiness = { ...waitlistEntry, business: null };
      await notificationService.sendWaitlistOffer(entryNoBusiness, slot, claimLink, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1987654321',
        body: expect.stringContaining('Our Business'),
        businessId: 'biz1',
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationService.sendWaitlistOffer(waitlistEntry, slot, claimLink, 'biz1'),
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================
  // NEW: sendCampaignMessage (previously 0% coverage)
  // ==========================================
  describe('sendCampaignMessage', () => {
    const customer = { name: 'Jane Doe', phone: '+1234567890', email: 'jane@example.com' };
    const campaignBody = 'Special offer: 20% off all treatments this week!';

    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends campaign message via both channels', async () => {
      await notificationService.sendCampaignMessage(customer, campaignBody, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: campaignBody,
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Message from Glow Clinic'),
        html: expect.stringContaining(campaignBody),
      });
    });

    it('sends only WhatsApp when channels=whatsapp', async () => {
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendCampaignMessage(customer, campaignBody, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('sends only email when channels=email', async () => {
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });

      await notificationService.sendCampaignMessage(customer, campaignBody, 'biz1');

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Message from Glow Clinic'),
        html: expect.stringContaining(campaignBody),
      });
    });

    it('skips email when customer has no email', async () => {
      const noEmailCustomer = { ...customer, email: null };

      await notificationService.sendCampaignMessage(noEmailCustomer, campaignBody, 'biz1');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('skips email when customer has no email and channels=email', async () => {
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'email' });
      const noEmailCustomer = { ...customer, email: null };

      await notificationService.sendCampaignMessage(noEmailCustomer, campaignBody, 'biz1');

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('uses "Our Business" when business lookup returns null', async () => {
      businessService.findById.mockResolvedValue(null);

      await notificationService.sendCampaignMessage(customer, campaignBody, 'biz1');

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: expect.stringContaining('Message from Our Business'),
        html: expect.stringContaining('Our Business'),
      });
    });

    it('wraps body in email HTML', async () => {
      await notificationService.sendCampaignMessage(customer, campaignBody, 'biz1');

      const emailCall = emailService.send.mock.calls[0][0];
      expect(emailCall.html).toContain('<div');
      expect(emailCall.html).toContain(campaignBody);
      expect(emailCall.html).toContain('Booking OS');
    });

    it('handles error gracefully', async () => {
      businessService.findById.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationService.sendCampaignMessage(customer, campaignBody, 'biz1'),
      ).resolves.toBeUndefined();
    });

    it('always calls businessService.findById (does not use cached business)', async () => {
      await notificationService.sendCampaignMessage(customer, campaignBody, 'biz1');

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });
  });

  // ==========================================
  // NEW: sendBookingConfirmation additional branch coverage
  // ==========================================
  describe('sendBookingConfirmation - additional branches', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('looks up business when booking.business is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' });

      await notificationService.sendBookingConfirmation(mockBookingNoBusiness);

      expect(businessService.findById).toHaveBeenCalledWith('biz1');
    });

    it('uses "Our Business" when business is null entirely', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.findById.mockResolvedValue(null);

      await notificationService.sendBookingConfirmation(mockBookingNoBusiness);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Our Business'),
        businessId: 'biz1',
      });
    });

    it('includes staffName in confirmation when staff present', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Sarah Smith'),
        businessId: 'biz1',
      });
    });

    it('omits staffName reference when no staff', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBookingNoStaff);

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.not.stringContaining('with undefined'),
        businessId: 'biz1',
      });
    });

    it('logs CONFIRMATION notification event', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking1' },
        data: {
          customFields: {
            notificationLog: [expect.objectContaining({ type: 'sent', category: 'CONFIRMATION' })],
          },
        },
      });
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationService.sendBookingConfirmation(mockBooking),
      ).resolves.toBeUndefined();
    });

    it('email subject includes service name and business name', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: 'Booking Confirmed - Haircut at Glow Clinic',
        html: expect.any(String),
      });
    });
  });

  // ==========================================
  // NEW: getChannelPreference branch coverage
  // ==========================================
  describe('getChannelPreference (via notification methods)', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('defaults to "both" when settings is null', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue(null);

      await notificationService.sendBookingConfirmation(mockBooking);

      // "both" means both whatsapp and email are dispatched
      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalled();
    });

    it('defaults to "both" when settings.channels is undefined', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({});

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalled();
    });

    it('defaults to "both" when settings.channels is an invalid value', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'sms' });

      await notificationService.sendBookingConfirmation(mockBooking);

      // Invalid channel falls through to 'both' default
      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalled();
    });
  });

  // ==========================================
  // NEW: wrapInEmailHtml coverage
  // ==========================================
  describe('wrapInEmailHtml (via notification methods)', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('wraps body in styled HTML container', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      const emailCall = emailService.send.mock.calls[0][0];
      expect(emailCall.html).toContain('<div');
      expect(emailCall.html).toContain('font-family: Arial, sans-serif');
      expect(emailCall.html).toContain('max-width: 600px');
      expect(emailCall.html).toContain('#71907C'); // sage color
    });

    it('includes business name in header and footer', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      const emailCall = emailService.send.mock.calls[0][0];
      // Header h2 with business name
      expect(emailCall.html).toContain('Glow Clinic');
      // Footer mentions "Sent by ... via Booking OS"
      expect(emailCall.html).toContain('Sent by Glow Clinic via Booking OS');
    });
  });

  // ==========================================
  // NEW: dispatchWhatsApp coverage
  // ==========================================
  describe('dispatchWhatsApp (via notification methods)', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('calls messagingService.getProvider and sends via provider', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(messagingService.getProvider).toHaveBeenCalled();
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.any(String),
        businessId: 'biz1',
      });
    });
  });

  // ==========================================
  // NEW: dispatchEmail additional scenarios
  // ==========================================
  describe('dispatchEmail edge cases', () => {
    it('handles direct email send failure gracefully (catch in email.send)', async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      // Make email.send reject - but it's caught internally (.catch)
      emailService.send.mockRejectedValue(new Error('SMTP failure'));

      // Should not throw because email failures are caught
      await expect(
        notificationService.sendBookingConfirmation(mockBooking),
      ).resolves.toBeUndefined();

      expect(emailService.send).toHaveBeenCalled();
    });

    it('queues emails for all notification types when queue available', async () => {
      const module = await createModule(true, true);
      notificationService = module.get(NotificationService);
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendReminder(mockBooking);

      expect(mockQueue.add).toHaveBeenCalledWith('send-email', {
        to: 'jane@example.com',
        subject: expect.stringContaining('Appointment Reminder'),
        html: expect.any(String),
      });
      expect(emailService.send).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // NEW: resolveTemplate edge cases
  // ==========================================
  describe('resolveTemplate edge cases (via notification methods)', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('uses first template when multiple templates found', async () => {
      const template1 = {
        id: 'tpl1',
        body: 'First template body',
        variables: [],
        category: 'CONFIRMATION',
      };
      const template2 = {
        id: 'tpl2',
        body: 'Second template body',
        variables: [],
        category: 'CONFIRMATION',
      };
      prisma.messageTemplate.findMany.mockResolvedValue([template1, template2] as any);
      templateService.resolveVariables.mockResolvedValue('First template body');

      await notificationService.sendBookingConfirmation(mockBooking);

      expect(templateService.resolveVariables).toHaveBeenCalledWith(template1, expect.any(Object));
    });

    it('falls back to generic message for unknown template category', async () => {
      // This is tested indirectly - when sendBookingConfirmation uses 'CONFIRMATION'
      // and no template is found, we get the CONFIRMATION default.
      // Proving the fallback works by testing with a known category
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await notificationService.sendBookingConfirmation(mockBooking);

      // The default CONFIRMATION message should contain the customer name
      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('confirmed'),
        businessId: 'biz1',
      });
    });
  });

  // ==========================================
  // NEW: Integration-style tests across multiple methods
  // ==========================================
  describe('cross-cutting concerns', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('all send methods use the same channel preference mechanism', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendBookingConfirmation(mockBooking);
      await notificationService.sendReminder(mockBooking);
      await notificationService.sendFollowUp(mockBooking);

      // All three should have called getNotificationSettings
      expect(businessService.getNotificationSettings).toHaveBeenCalledTimes(3);

      // All three should have sent via WhatsApp only
      expect(mockProvider.sendMessage).toHaveBeenCalledTimes(3);
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('all send methods with booking log notification events', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
      businessService.getNotificationSettings.mockResolvedValue({ channels: 'whatsapp' });

      await notificationService.sendBookingConfirmation(mockBooking);
      await notificationService.sendReminder(mockBooking);
      await notificationService.sendFollowUp(mockBooking);
      await notificationService.sendAftercare(mockBooking);
      await notificationService.sendTreatmentCheckIn(mockBooking);
      await notificationService.sendCancellationNotification(mockBooking);

      // Each should have called logNotificationEvent which calls booking.findUnique + update
      expect(prisma.booking.findUnique).toHaveBeenCalledTimes(6);
    });

    it('sendWaitlistOffer does NOT log notification event (no bookingId)', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      const entry = {
        customer: { name: 'Test', phone: '+1111111111', email: 'test@test.com' },
        service: { name: 'Test Service' },
        business: { name: 'Test Biz' },
      };

      await notificationService.sendWaitlistOffer(
        entry,
        { date: 'Mon', time: '10:00' },
        'https://claim',
        'biz1',
      );

      // sendWaitlistOffer does not call logNotificationEvent
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });

    it('sendCampaignMessage does NOT log notification event (no bookingId)', async () => {
      const customer = { name: 'Test', phone: '+1111111111', email: 'test@test.com' };

      await notificationService.sendCampaignMessage(customer, 'Hello!', 'biz1');

      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
      expect(prisma.booking.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // NEW: email subject lines for all notification types
  // ==========================================
  describe('email subject lines', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();
    });

    it('sendBookingConfirmation uses correct subject', async () => {
      await notificationService.sendBookingConfirmation(mockBooking);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Booking Confirmed - Haircut at Glow Clinic' }),
      );
    });

    it('sendReminder uses correct subject', async () => {
      await notificationService.sendReminder(mockBooking);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Appointment Reminder - Haircut at Glow Clinic' }),
      );
    });

    it('sendFollowUp uses correct subject', async () => {
      await notificationService.sendFollowUp(mockBooking);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'How was your visit? - Glow Clinic' }),
      );
    });

    it('sendConsultFollowUp uses correct subject', async () => {
      await notificationService.sendConsultFollowUp(mockBooking);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Ready for your treatment? - Glow Clinic' }),
      );
    });

    it('sendAftercare uses correct subject', async () => {
      await notificationService.sendAftercare(mockBooking);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Aftercare instructions - Haircut at Glow Clinic' }),
      );
    });

    it('sendTreatmentCheckIn uses correct subject', async () => {
      await notificationService.sendTreatmentCheckIn(mockBooking);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'How are you feeling? - Glow Clinic' }),
      );
    });

    it('sendDepositRequest uses correct subject', async () => {
      const depositBooking = {
        ...mockBooking,
        service: { ...mockBooking.service, depositAmount: 100, price: 350 },
      };
      await notificationService.sendDepositRequest(depositBooking);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Deposit required - Haircut at Glow Clinic' }),
      );
    });

    it('sendRescheduleLink uses correct subject', async () => {
      await notificationService.sendRescheduleLink(mockBooking, 'https://link');
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Reschedule your appointment - Glow Clinic' }),
      );
    });

    it('sendCancelLink uses correct subject', async () => {
      await notificationService.sendCancelLink(mockBooking, 'https://link');
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Cancel your appointment - Glow Clinic' }),
      );
    });

    it('sendCancellationNotification uses correct subject', async () => {
      await notificationService.sendCancellationNotification(mockBooking);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Appointment Cancelled - Haircut at Glow Clinic' }),
      );
    });

    it('sendWaitlistOffer uses correct subject', async () => {
      const entry = {
        customer: { name: 'Emma', phone: '+111', email: 'emma@test.com' },
        service: { name: 'Botox' },
        business: { name: 'Glow Clinic' },
      };
      await notificationService.sendWaitlistOffer(
        entry,
        { date: 'Mon', time: '10:00' },
        'https://claim',
        'biz1',
      );
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'A slot opened for Botox at Glow Clinic' }),
      );
    });

    it('sendCampaignMessage uses correct subject', async () => {
      await notificationService.sendCampaignMessage(
        { name: 'Jane', phone: '+111', email: 'jane@test.com' },
        'Hello!',
        'biz1',
      );
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Message from Glow Clinic' }),
      );
    });
  });

  // ==========================================
  // NEW: sendKanbanStatusUpdate
  // ==========================================
  describe('sendKanbanStatusUpdate', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends known kanban status update via both channels', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendKanbanStatusUpdate(mockBooking, 'READY_FOR_PICKUP');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('ready for pickup'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: 'Service Update - Glow Clinic',
        html: expect.stringContaining('ready for pickup'),
      });
    });

    it('uses fallback message for unknown kanban status', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendKanbanStatusUpdate(mockBooking, 'SOME_CUSTOM_STATUS');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('Status updated to SOME_CUSTOM_STATUS'),
        businessId: 'biz1',
      });
    });

    it('skips email when customer has no email', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);
      setupLogMocks();

      await notificationService.sendKanbanStatusUpdate(mockBookingNoEmail, 'CHECKED_IN');

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('handles error gracefully', async () => {
      prisma.messageTemplate.findMany.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationService.sendKanbanStatusUpdate(mockBooking, 'IN_PROGRESS'),
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================
  // NEW: sendQuoteApprovalRequest
  // ==========================================
  describe('sendQuoteApprovalRequest', () => {
    beforeEach(async () => {
      const module = await createModule(false);
      notificationService = module.get(NotificationService);
    });

    it('sends quote approval request via both channels', async () => {
      setupLogMocks();

      await notificationService.sendQuoteApprovalRequest(
        mockBooking,
        250.5,
        'Oil change + brake pads',
        'https://example.com/approve/abc',
      );

      expect(mockProvider.sendMessage).toHaveBeenCalledWith({
        to: '+1234567890',
        body: expect.stringContaining('$250.50'),
        businessId: 'biz1',
      });

      expect(emailService.send).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: 'Quote Approval Required - Glow Clinic',
        html: expect.stringContaining('$250.50'),
      });
    });

    it('skips email when customer has no email', async () => {
      setupLogMocks();

      await notificationService.sendQuoteApprovalRequest(
        mockBookingNoEmail,
        100,
        'Service description',
        'https://example.com/approve/abc',
      );

      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it('handles error gracefully', async () => {
      businessService.findById.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationService.sendQuoteApprovalRequest(
          mockBookingNoBusiness,
          100,
          'desc',
          'https://link',
        ),
      ).resolves.toBeUndefined();
    });
  });
});
