import { Test } from '@nestjs/testing';
import { AiService } from './ai.service';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { ClaudeClient } from './claude.client';
import { IntentDetector } from './intent-detector';
import { ReplyGenerator } from './reply-generator';
import { BookingAssistant } from './booking-assistant';
import { CancelAssistant } from './cancel-assistant';
import { RescheduleAssistant } from './reschedule-assistant';
import { SummaryGenerator } from './summary-generator';
import { ProfileCollector } from './profile-collector';
import { ServiceService } from '../service/service.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookingService } from '../booking/booking.service';
import { MessageService } from '../message/message.service';
import { MessagingService } from '../messaging/messaging.service';
import { createMockPrisma } from '../../test/mocks';

describe('AiService', () => {
  let aiService: AiService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let inboxGateway: jest.Mocked<InboxGateway>;
  let claude: jest.Mocked<ClaudeClient>;
  let intentDetector: jest.Mocked<IntentDetector>;
  let replyGenerator: jest.Mocked<ReplyGenerator>;
  let bookingAssistant: jest.Mocked<BookingAssistant>;
  let cancelAssistant: jest.Mocked<CancelAssistant>;
  let rescheduleAssistant: jest.Mocked<RescheduleAssistant>;
  let summaryGenerator: jest.Mocked<SummaryGenerator>;
  let profileCollector: jest.Mocked<ProfileCollector>;
  let serviceService: jest.Mocked<ServiceService>;
  let availabilityService: jest.Mocked<AvailabilityService>;
  let bookingService: jest.Mocked<BookingService>;
  let messageService: jest.Mocked<MessageService>;
  let messagingService: jest.Mocked<MessagingService>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    inboxGateway = {
      notifyBookingUpdate: jest.fn(),
      emitToBusinessRoom: jest.fn(),
    } as any;

    claude = {
      isAvailable: jest.fn().mockReturnValue(true),
      complete: jest.fn().mockResolvedValue('{}'),
    } as any;

    intentDetector = {
      detect: jest.fn().mockResolvedValue({
        intent: 'GENERAL',
        confidence: 0.9,
        extractedEntities: {},
      }),
    } as any;

    replyGenerator = {
      generate: jest.fn().mockResolvedValue({
        draftText: 'Draft reply',
      }),
    } as any;

    bookingAssistant = {
      process: jest.fn().mockResolvedValue({
        state: 'IDENTIFY_SERVICE',
        suggestedResponse: 'How can I help you book?',
      }),
    } as any;

    cancelAssistant = {
      process: jest.fn().mockResolvedValue({
        state: 'IDENTIFY_BOOKING',
        suggestedResponse: 'Which booking would you like to cancel?',
      }),
    } as any;

    rescheduleAssistant = {
      process: jest.fn().mockResolvedValue({
        state: 'IDENTIFY_BOOKING',
        suggestedResponse: 'Which booking would you like to reschedule?',
      }),
    } as any;

    summaryGenerator = {
      generate: jest.fn().mockResolvedValue('Summary of conversation'),
    } as any;

    profileCollector = {
      collect: jest.fn().mockResolvedValue({
        missingFields: [],
        collectedFields: {},
        allCollected: true,
        suggestedResponse: 'Thank you for the information',
      }),
    } as any;

    serviceService = {
      findAll: jest.fn().mockResolvedValue([]),
    } as any;

    availabilityService = {
      getAvailableSlots: jest.fn().mockResolvedValue([]),
    } as any;

    bookingService = {
      create: jest.fn().mockResolvedValue({ id: 'booking1' }),
      update: jest.fn().mockResolvedValue({ id: 'booking1' }),
      updateStatus: jest.fn().mockResolvedValue({ id: 'booking1' }),
    } as any;

    messageService = {
      sendMessage: jest.fn().mockResolvedValue({ id: 'msg1' }),
    } as any;

    messagingService = {
      getProvider: jest.fn().mockReturnValue('whatsapp'),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prisma },
        { provide: InboxGateway, useValue: inboxGateway },
        { provide: ClaudeClient, useValue: claude },
        { provide: IntentDetector, useValue: intentDetector },
        { provide: ReplyGenerator, useValue: replyGenerator },
        { provide: BookingAssistant, useValue: bookingAssistant },
        { provide: CancelAssistant, useValue: cancelAssistant },
        { provide: RescheduleAssistant, useValue: rescheduleAssistant },
        { provide: SummaryGenerator, useValue: summaryGenerator },
        { provide: ProfileCollector, useValue: profileCollector },
        { provide: ServiceService, useValue: serviceService },
        { provide: AvailabilityService, useValue: availabilityService },
        { provide: BookingService, useValue: bookingService },
        { provide: MessageService, useValue: messageService },
        { provide: MessagingService, useValue: messagingService },
      ],
    }).compile();

    aiService = module.get(AiService);
  });

  describe('getAiUsage', () => {
    const today = new Date().toISOString().split('T')[0];

    it('returns cached count when available', async () => {
      // Pre-populate cache
      prisma.aiUsage.findUnique.mockResolvedValue({
        id: '1',
        businessId: 'biz1',
        date: today,
        count: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // First call to populate cache
      await aiService.getAiUsage('biz1');

      // Second call should use cache
      prisma.aiUsage.findUnique.mockClear();
      const result = await aiService.getAiUsage('biz1');

      expect(result).toEqual({
        count: 50,
        date: today,
        limit: 500,
      });
      expect(prisma.aiUsage.findUnique).not.toHaveBeenCalled();
    });

    it('returns DB count on cache miss', async () => {
      prisma.aiUsage.findUnique.mockResolvedValue({
        id: '1',
        businessId: 'biz1',
        date: today,
        count: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await aiService.getAiUsage('biz1');

      expect(result).toEqual({
        count: 100,
        date: today,
        limit: 500,
      });
      expect(prisma.aiUsage.findUnique).toHaveBeenCalledWith({
        where: { businessId_date: { businessId: 'biz1', date: today } },
      });
    });

    it('returns 0 when no record exists', async () => {
      prisma.aiUsage.findUnique.mockResolvedValue(null);

      const result = await aiService.getAiUsage('biz1');

      expect(result).toEqual({
        count: 0,
        date: today,
        limit: 500,
      });
    });

    it('populates cache after DB query', async () => {
      prisma.aiUsage.findUnique.mockResolvedValue({
        id: '1',
        businessId: 'biz1',
        date: today,
        count: 75,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // First call
      await aiService.getAiUsage('biz1');

      // Clear mock and call again
      prisma.aiUsage.findUnique.mockClear();
      const result = await aiService.getAiUsage('biz1');

      expect(result.count).toBe(75);
      expect(prisma.aiUsage.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('processInboundMessage', () => {
    const mockBusiness = {
      id: 'biz1',
      name: 'Test Business',
      aiSettings: { enabled: true },
    };

    const mockConversation = {
      id: 'conv1',
      businessId: 'biz1',
      customerId: 'cust1',
      metadata: {},
    };

    const mockMessages = [
      {
        id: 'msg1',
        conversationId: 'conv1',
        content: 'Hello',
        direction: 'INBOUND',
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness as any);
      prisma.conversation.findUnique.mockResolvedValue(mockConversation as any);
      prisma.message.findMany.mockResolvedValue(mockMessages as any);
      prisma.message.update.mockResolvedValue({} as any);
      prisma.message.count.mockResolvedValue(1);
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.aiUsage.findUnique.mockResolvedValue(null);
      prisma.aiUsage.upsert.mockResolvedValue({} as any);
    });

    it('skips processing when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      expect(intentDetector.detect).not.toHaveBeenCalled();
    });

    it('skips processing when AI is disabled', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        aiSettings: { enabled: false },
      } as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      expect(intentDetector.detect).not.toHaveBeenCalled();
    });

    it('skips processing when Claude client not available', async () => {
      claude.isAvailable.mockReturnValue(false);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      expect(intentDetector.detect).not.toHaveBeenCalled();
    });

    it('skips processing when rate limit exceeded', async () => {
      const today = new Date().toISOString().split('T')[0];
      prisma.aiUsage.findUnique.mockResolvedValue({
        id: '1',
        businessId: 'biz1',
        date: today,
        count: 500, // At limit
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      expect(intentDetector.detect).not.toHaveBeenCalled();
    });

    it('processes message when all conditions met', async () => {
      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      expect(intentDetector.detect).toHaveBeenCalledWith('Hello', undefined, undefined);
      expect(prisma.message.update).toHaveBeenCalled();
    });

    it('increments AI usage count', async () => {
      const today = new Date().toISOString().split('T')[0];

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      // Check that upsert was called (fire-and-forget, but we can verify it was invoked)
      // Wait a tick for the async upsert
      await new Promise((resolve) => setImmediate(resolve));

      expect(prisma.aiUsage.upsert).toHaveBeenCalledWith({
        where: { businessId_date: { businessId: 'biz1', date: today } },
        update: { count: 1 },
        create: { businessId: 'biz1', date: today, count: 1 },
      });
    });

    it('stores intent in message metadata', async () => {
      intentDetector.detect.mockResolvedValue({
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.95,
        extractedEntities: { date: '2026-03-01' },
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Book for March 1st');

      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'msg1' },
        data: {
          metadata: {
            ai: {
              intent: 'BOOK_APPOINTMENT',
              confidence: 0.95,
              extractedEntities: { date: '2026-03-01' },
            },
          },
        },
      });
    });
  });

  describe('confirmBooking', () => {
    const mockConversation = {
      id: 'conv1',
      businessId: 'biz1',
      customerId: 'cust1',
      metadata: {
        aiBookingState: {
          state: 'CONFIRM',
          serviceId: 'svc1',
          serviceName: 'Haircut',
          date: '2026-03-01',
          time: '14:00',
          slotIso: '2026-03-01T14:00:00Z',
          staffId: 'staff1',
          staffName: 'John',
        },
      },
    };

    it('creates booking and clears state', async () => {
      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.conversation.update.mockResolvedValue({} as any);
      bookingService.create.mockResolvedValue({ id: 'booking1' } as any);

      const result = await aiService.confirmBooking('biz1', 'conv1');

      expect(bookingService.create).toHaveBeenCalledWith('biz1', {
        customerId: 'cust1',
        serviceId: 'svc1',
        staffId: 'staff1',
        conversationId: 'conv1',
        startTime: '2026-03-01T14:00:00Z',
      });
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { metadata: { aiBookingState: null } },
      });
      expect(inboxGateway.notifyBookingUpdate).toHaveBeenCalledWith('biz1', { id: 'booking1' });
      expect(result).toEqual({ id: 'booking1' });
    });

    it('throws when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(aiService.confirmBooking('biz1', 'conv1')).rejects.toThrow(
        'Conversation not found',
      );
    });

    it('throws when no booking state found', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {},
      } as any);

      await expect(aiService.confirmBooking('biz1', 'conv1')).rejects.toThrow(
        'No booking state found',
      );
    });

    it('throws when state is not CONFIRM', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {
          aiBookingState: {
            state: 'IDENTIFY_SERVICE',
          },
        },
      } as any);

      await expect(aiService.confirmBooking('biz1', 'conv1')).rejects.toThrow(
        'Booking not ready for confirmation',
      );
    });

    it('throws when serviceId is missing', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {
          aiBookingState: {
            state: 'CONFIRM',
            slotIso: '2026-03-01T14:00:00Z',
          },
        },
      } as any);

      await expect(aiService.confirmBooking('biz1', 'conv1')).rejects.toThrow(
        'Missing service or time slot',
      );
    });

    it('throws when slotIso is missing', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {
          aiBookingState: {
            state: 'CONFIRM',
            serviceId: 'svc1',
          },
        },
      } as any);

      await expect(aiService.confirmBooking('biz1', 'conv1')).rejects.toThrow(
        'Missing service or time slot',
      );
    });
  });

  describe('confirmCancel', () => {
    const mockConversation = {
      id: 'conv1',
      businessId: 'biz1',
      customerId: 'cust1',
      metadata: {
        aiCancelState: {
          state: 'CONFIRM_CANCEL',
          bookingId: 'booking1',
          serviceName: 'Haircut',
          date: '2026-03-01',
          time: '14:00',
        },
      },
    };

    it('cancels booking and clears state', async () => {
      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.conversation.update.mockResolvedValue({} as any);
      bookingService.updateStatus.mockResolvedValue({ id: 'booking1', status: 'CANCELLED' } as any);

      const result = await aiService.confirmCancel('biz1', 'conv1');

      expect(bookingService.updateStatus).toHaveBeenCalledWith('biz1', 'booking1', 'CANCELLED');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { metadata: { aiCancelState: null } },
      });
      expect(inboxGateway.notifyBookingUpdate).toHaveBeenCalledWith('biz1', {
        id: 'booking1',
        status: 'CANCELLED',
      });
      expect(result).toEqual({ id: 'booking1', status: 'CANCELLED' });
    });

    it('throws when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(aiService.confirmCancel('biz1', 'conv1')).rejects.toThrow(
        'Conversation not found',
      );
    });

    it('throws when no cancel state found', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {},
      } as any);

      await expect(aiService.confirmCancel('biz1', 'conv1')).rejects.toThrow(
        'No cancel state found',
      );
    });

    it('throws when state is not CONFIRM_CANCEL', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {
          aiCancelState: {
            state: 'IDENTIFY_BOOKING',
          },
        },
      } as any);

      await expect(aiService.confirmCancel('biz1', 'conv1')).rejects.toThrow(
        'Cancel not ready for confirmation',
      );
    });

    it('throws when bookingId is missing', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {
          aiCancelState: {
            state: 'CONFIRM_CANCEL',
          },
        },
      } as any);

      await expect(aiService.confirmCancel('biz1', 'conv1')).rejects.toThrow(
        'No booking identified',
      );
    });
  });

  describe('confirmReschedule', () => {
    const mockConversation = {
      id: 'conv1',
      businessId: 'biz1',
      customerId: 'cust1',
      metadata: {
        aiRescheduleState: {
          state: 'CONFIRM_RESCHEDULE',
          bookingId: 'booking1',
          serviceId: 'svc1',
          serviceName: 'Haircut',
          newDate: '2026-03-05',
          newTime: '10:00',
          newSlotIso: '2026-03-05T10:00:00Z',
          staffId: 'staff1',
          staffName: 'John',
        },
      },
    };

    it('updates booking and clears state', async () => {
      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.conversation.update.mockResolvedValue({} as any);
      bookingService.update.mockResolvedValue({
        id: 'booking1',
        startTime: new Date('2026-03-05T10:00:00Z'),
      } as any);

      const result = await aiService.confirmReschedule('biz1', 'conv1');

      expect(bookingService.update).toHaveBeenCalledWith('biz1', 'booking1', {
        startTime: '2026-03-05T10:00:00Z',
      });
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { metadata: { aiRescheduleState: null } },
      });
      expect(inboxGateway.notifyBookingUpdate).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'booking1');
    });

    it('throws when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(aiService.confirmReschedule('biz1', 'conv1')).rejects.toThrow(
        'Conversation not found',
      );
    });

    it('throws when no reschedule state found', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {},
      } as any);

      await expect(aiService.confirmReschedule('biz1', 'conv1')).rejects.toThrow(
        'No reschedule state found',
      );
    });

    it('throws when state is not CONFIRM_RESCHEDULE', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {
          aiRescheduleState: {
            state: 'IDENTIFY_BOOKING',
          },
        },
      } as any);

      await expect(aiService.confirmReschedule('biz1', 'conv1')).rejects.toThrow(
        'Reschedule not ready for confirmation',
      );
    });

    it('throws when bookingId is missing', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {
          aiRescheduleState: {
            state: 'CONFIRM_RESCHEDULE',
            newSlotIso: '2026-03-05T10:00:00Z',
          },
        },
      } as any);

      await expect(aiService.confirmReschedule('biz1', 'conv1')).rejects.toThrow(
        'Missing booking or new time slot',
      );
    });

    it('throws when newSlotIso is missing', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        metadata: {
          aiRescheduleState: {
            state: 'CONFIRM_RESCHEDULE',
            bookingId: 'booking1',
          },
        },
      } as any);

      await expect(aiService.confirmReschedule('biz1', 'conv1')).rejects.toThrow(
        'Missing booking or new time slot',
      );
    });
  });

  describe('clearBookingState', () => {
    it('clears booking state from conversation metadata', async () => {
      const mockConversation = {
        id: 'conv1',
        businessId: 'biz1',
        metadata: {
          aiBookingState: { state: 'CONFIRM' },
          otherData: 'preserved',
        },
      };

      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      await aiService.clearBookingState('biz1', 'conv1');

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: {
          metadata: {
            aiBookingState: null,
            otherData: 'preserved',
          },
        },
      });
    });

    it('does nothing when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await aiService.clearBookingState('biz1', 'conv1');

      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
  });

  describe('clearCancelState', () => {
    it('clears cancel state from conversation metadata', async () => {
      const mockConversation = {
        id: 'conv1',
        businessId: 'biz1',
        metadata: {
          aiCancelState: { state: 'CONFIRM_CANCEL' },
          otherData: 'preserved',
        },
      };

      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      await aiService.clearCancelState('biz1', 'conv1');

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: {
          metadata: {
            aiCancelState: null,
            otherData: 'preserved',
          },
        },
      });
    });

    it('does nothing when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await aiService.clearCancelState('biz1', 'conv1');

      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
  });

  describe('clearRescheduleState', () => {
    it('clears reschedule state from conversation metadata', async () => {
      const mockConversation = {
        id: 'conv1',
        businessId: 'biz1',
        metadata: {
          aiRescheduleState: { state: 'CONFIRM_RESCHEDULE' },
          otherData: 'preserved',
        },
      };

      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      await aiService.clearRescheduleState('biz1', 'conv1');

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: {
          metadata: {
            aiRescheduleState: null,
            otherData: 'preserved',
          },
        },
      });
    });

    it('does nothing when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await aiService.clearRescheduleState('biz1', 'conv1');

      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
  });

  describe('resumeAutoReply', () => {
    it('sets transferredToHuman to false', async () => {
      const mockConversation = {
        id: 'conv1',
        businessId: 'biz1',
        metadata: {
          transferredToHuman: true,
          otherData: 'preserved',
        },
      };

      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      await aiService.resumeAutoReply('biz1', 'conv1');

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: {
          metadata: {
            transferredToHuman: false,
            otherData: 'preserved',
          },
        },
      });
    });

    it('does nothing when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await aiService.resumeAutoReply('biz1', 'conv1');

      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
  });

  describe('generateAndStoreSummary', () => {
    const mockConversation = {
      id: 'conv1',
      businessId: 'biz1',
      metadata: {},
    };

    const mockMessages = [
      { direction: 'INBOUND', content: 'Hello', createdAt: new Date('2026-01-01T10:00:00Z') },
      { direction: 'OUTBOUND', content: 'Hi there', createdAt: new Date('2026-01-01T10:01:00Z') },
    ];

    it('generates and stores summary', async () => {
      prisma.conversation.findUnique.mockResolvedValue(mockConversation as any);
      prisma.message.findMany.mockResolvedValue(mockMessages as any);
      prisma.conversation.update.mockResolvedValue({} as any);
      summaryGenerator.generate.mockResolvedValue('Conversation summary');

      const result = await aiService.generateAndStoreSummary('conv1');

      expect(summaryGenerator.generate).toHaveBeenCalledWith(
        [
          { direction: 'INBOUND', content: 'Hello', createdAt: expect.any(String) },
          { direction: 'OUTBOUND', content: 'Hi there', createdAt: expect.any(String) },
        ],
        undefined,
      );
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: {
          metadata: { aiSummary: 'Conversation summary' },
        },
      });
      expect(result).toBe('Conversation summary');
    });

    it('passes existing summary to generator', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        metadata: { aiSummary: 'Previous summary' },
      } as any);
      prisma.message.findMany.mockResolvedValue(mockMessages as any);
      prisma.conversation.update.mockResolvedValue({} as any);
      summaryGenerator.generate.mockResolvedValue('Updated summary');

      await aiService.generateAndStoreSummary('conv1');

      expect(summaryGenerator.generate).toHaveBeenCalledWith(expect.any(Array), 'Previous summary');
    });

    it('returns empty string when conversation not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      const result = await aiService.generateAndStoreSummary('conv1');

      expect(result).toBe('');
      expect(summaryGenerator.generate).not.toHaveBeenCalled();
    });
  });

  describe('customerChat', () => {
    const mockBusiness = {
      id: 'biz1',
      name: 'Test Business',
    };

    const mockCustomer = {
      id: 'cust1',
      businessId: 'biz1',
      name: 'John Doe',
      phone: '+1234567890',
      email: 'john@example.com',
      tags: ['vip'],
      customFields: { notes: 'Regular customer' },
      createdAt: new Date('2025-01-01'),
    };

    const mockBookings = [
      {
        id: 'booking1',
        customerId: 'cust1',
        businessId: 'biz1',
        status: 'COMPLETED',
        startTime: new Date('2026-01-15T10:00:00Z'),
        service: { name: 'Haircut', price: 50 },
        staff: { name: 'Jane' },
      },
    ];

    beforeEach(() => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness as any);
      prisma.customer.findFirst.mockResolvedValue(mockCustomer as any);
      prisma.booking.findMany.mockResolvedValue(mockBookings as any);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.message.findMany.mockResolvedValue([]);
      claude.complete.mockResolvedValue('Customer analysis response');
    });

    it('calls Claude with customer data and returns answer', async () => {
      const result = await aiService.customerChat(
        'biz1',
        'cust1',
        "What is this customer's history?",
      );

      expect(prisma.business.findUnique).toHaveBeenCalledWith({ where: { id: 'biz1' } });
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust1', businessId: 'biz1' },
      });
      expect(prisma.booking.findMany).toHaveBeenCalled();
      expect(claude.complete).toHaveBeenCalledWith(
        'sonnet',
        expect.stringContaining('Test Business'),
        [{ role: 'user', content: "What is this customer's history?" }],
        1024,
      );
      expect(result).toEqual({ answer: 'Customer analysis response' });
    });

    it('includes customer profile in system prompt', async () => {
      await aiService.customerChat('biz1', 'cust1', 'Tell me about this customer');

      const systemPrompt = claude.complete.mock.calls[0][1];
      expect(systemPrompt).toContain('John Doe');
      expect(systemPrompt).toContain('+1234567890');
      expect(systemPrompt).toContain('john@example.com');
      expect(systemPrompt).toContain('vip');
    });

    it('includes booking history in system prompt', async () => {
      await aiService.customerChat('biz1', 'cust1', 'What services has this customer had?');

      const systemPrompt = claude.complete.mock.calls[0][1];
      expect(systemPrompt).toContain('Haircut');
      expect(systemPrompt).toContain('COMPLETED');
    });

    it('throws when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(aiService.customerChat('biz1', 'cust1', 'Question')).rejects.toThrow(
        'Business not found',
      );
    });

    it('throws when customer not found', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(aiService.customerChat('biz1', 'cust1', 'Question')).rejects.toThrow(
        'Customer not found',
      );
    });
  });

  // ─── Dealership AI intents ──────────────────────────────────────────

  describe('dealership intents — processInboundMessage', () => {
    const mockDealershipBusiness = {
      id: 'biz1',
      name: 'Metro Auto Group',
      verticalPack: 'dealership',
      aiSettings: { enabled: true, autoReplySuggestions: true, bookingAssistant: true },
      packConfig: { requiredProfileFields: ['firstName', 'phone'] },
    };

    const mockConversation = {
      id: 'conv1',
      businessId: 'biz1',
      customerId: 'cust1',
      metadata: {},
    };

    const mockCustomer = {
      id: 'cust1',
      name: 'John Smith',
      phone: '+1234567890',
      email: 'john@test.com',
      tags: [],
      customFields: {},
    };

    const mockMessages = [
      {
        id: 'msg1',
        conversationId: 'conv1',
        content: 'My brakes are squeaking',
        direction: 'INBOUND',
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      prisma.business.findUnique.mockResolvedValue(mockDealershipBusiness as any);
      prisma.conversation.findUnique.mockResolvedValue(mockConversation as any);
      prisma.message.findMany.mockResolvedValue(mockMessages as any);
      prisma.message.update.mockResolvedValue({} as any);
      prisma.message.count.mockResolvedValue(1);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer as any);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.aiUsage.findUnique.mockResolvedValue(null);
      prisma.aiUsage.upsert.mockResolvedValue({} as any);
      prisma.conversation.update.mockResolvedValue({} as any);
    });

    it('passes verticalPack to intent detector for dealership business', async () => {
      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'My brakes are squeaking');

      expect(intentDetector.detect).toHaveBeenCalledWith(
        'My brakes are squeaking',
        undefined,
        'dealership',
      );
    });

    it('routes SERVICE_APPOINTMENT to booking assistant', async () => {
      intentDetector.detect.mockResolvedValue({
        intent: 'SERVICE_APPOINTMENT',
        confidence: 0.95,
        extractedEntities: { service: 'Brake Service' },
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'My brakes are squeaking');

      expect(bookingAssistant.process).toHaveBeenCalled();
    });

    it('handles SALES_INQUIRY by transferring to human with sales tag', async () => {
      intentDetector.detect.mockResolvedValue({
        intent: 'SALES_INQUIRY',
        confidence: 0.9,
        extractedEntities: {},
      });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', name: 'Admin', role: 'ADMIN' } as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      await aiService.processInboundMessage(
        'biz1',
        'conv1',
        'msg1',
        'Do you have the 2024 Tacoma?',
      );

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conv1' },
          data: expect.objectContaining({
            assignedToId: 'staff1',
            metadata: expect.objectContaining({
              transferredToHuman: true,
              salesInquiry: true,
            }),
          }),
        }),
      );
      expect(messageService.sendMessage).toHaveBeenCalledWith(
        'biz1',
        'conv1',
        'staff1',
        expect.stringContaining('sales team'),
        'whatsapp',
      );
      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'ai:transferred',
        expect.objectContaining({ reason: 'sales_inquiry' }),
      );
    });

    it('handles TRADE_IN_INQUIRY by starting vehicle collection', async () => {
      intentDetector.detect.mockResolvedValue({
        intent: 'TRADE_IN_INQUIRY',
        confidence: 0.85,
        extractedEntities: {},
      });
      profileCollector.collect.mockResolvedValue({
        collectedFields: { make: 'Honda' },
        missingFields: ['model', 'year', 'mileage'],
        suggestedResponse: 'What model is your Honda?',
        allCollected: false,
      });
      prisma.conversation.update.mockResolvedValue({} as any);
      prisma.customer.update.mockResolvedValue({} as any);

      await aiService.processInboundMessage(
        'biz1',
        'conv1',
        'msg1',
        'I want to trade in my Honda',
      );

      // Should save collected fields to customer
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust1' },
        data: { customFields: { make: 'Honda' } },
      });

      // Should save trade-in state
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              aiTradeInState: expect.objectContaining({
                state: 'COLLECTING',
                collectedFields: { make: 'Honda' },
              }),
            }),
          }),
        }),
      );
    });

    it('continues trade-in collection when active state exists', async () => {
      const convWithTradeIn = {
        ...mockConversation,
        metadata: {
          aiTradeInState: {
            state: 'COLLECTING',
            collectedFields: { make: 'Honda', model: 'Civic' },
          },
        },
      };
      prisma.conversation.findUnique.mockResolvedValue(convWithTradeIn as any);

      intentDetector.detect.mockResolvedValue({
        intent: 'GENERAL',
        confidence: 0.5,
        extractedEntities: {},
      });
      profileCollector.collect.mockResolvedValue({
        collectedFields: { year: '2020', mileage: '45000' },
        missingFields: [],
        suggestedResponse: 'Thanks for the info!',
        allCollected: true,
      });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', name: 'Admin', role: 'ADMIN' } as any);
      prisma.conversation.update.mockResolvedValue({} as any);
      prisma.customer.update.mockResolvedValue({} as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', '2020, 45000 miles');

      // Should transfer to human when all collected
      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedToId: 'staff1',
            metadata: expect.objectContaining({
              aiTradeInState: null,
              transferredToHuman: true,
              tradeInInquiry: true,
            }),
          }),
        }),
      );
    });

    it('does not pass verticalPack when business has no verticalPack', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Test Business',
        aiSettings: { enabled: true },
      } as any);
      prisma.customer.findUnique.mockResolvedValue(null);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      expect(intentDetector.detect).toHaveBeenCalledWith('Hello', undefined, undefined);
    });
  });

  describe('clearTradeInState', () => {
    it('clears trade-in state from conversation metadata', async () => {
      const mockConversation = {
        id: 'conv1',
        businessId: 'biz1',
        metadata: {
          aiTradeInState: { state: 'COLLECTING', collectedFields: { make: 'Honda' } },
          otherData: 'preserved',
        },
      };

      prisma.conversation.findFirst.mockResolvedValue(mockConversation as any);
      prisma.conversation.update.mockResolvedValue({} as any);

      await aiService.clearTradeInState('biz1', 'conv1');

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: {
          metadata: {
            aiTradeInState: null,
            otherData: 'preserved',
          },
        },
      });
    });

    it('does nothing when conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await aiService.clearTradeInState('biz1', 'conv1');

      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });
  });

  describe('processInboundMessage — routing to assistants', () => {
    const mockBusiness = {
      id: 'biz1',
      name: 'Test Business',
      aiSettings: { enabled: true, autoReplySuggestions: true, bookingAssistant: true },
    };

    const mockConversation = {
      id: 'conv1',
      businessId: 'biz1',
      customerId: 'cust1',
      metadata: {},
    };

    const mockMessages = [
      {
        id: 'msg1',
        conversationId: 'conv1',
        content: 'Hello',
        direction: 'INBOUND',
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness as any);
      prisma.conversation.findUnique.mockResolvedValue(mockConversation as any);
      prisma.message.findMany.mockResolvedValue(mockMessages as any);
      prisma.message.update.mockResolvedValue({} as any);
      prisma.message.count.mockResolvedValue(3);
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.aiUsage.findUnique.mockResolvedValue(null);
      prisma.aiUsage.upsert.mockResolvedValue({} as any);
      prisma.conversation.update.mockResolvedValue({} as any);
    });

    it('routes BOOK_APPOINTMENT to booking assistant', async () => {
      intentDetector.detect.mockResolvedValue({
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.95,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'I want to book');

      expect(bookingAssistant.process).toHaveBeenCalled();
    });

    it('routes CANCEL to cancel assistant', async () => {
      intentDetector.detect.mockResolvedValue({
        intent: 'CANCEL',
        confidence: 0.9,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Cancel my appointment');

      expect(cancelAssistant.process).toHaveBeenCalled();
    });

    it('routes RESCHEDULE to reschedule assistant', async () => {
      intentDetector.detect.mockResolvedValue({
        intent: 'RESCHEDULE',
        confidence: 0.9,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Reschedule please');

      expect(rescheduleAssistant.process).toHaveBeenCalled();
    });

    it('continues active booking flow even if intent changes', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        metadata: { aiBookingState: { state: 'IDENTIFY_SERVICE' } },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'GENERAL',
        confidence: 0.5,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'The haircut one please');

      expect(bookingAssistant.process).toHaveBeenCalled();
    });

    it('continues active cancel flow even if intent changes', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        metadata: { aiCancelState: { state: 'IDENTIFY_BOOKING' } },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'GENERAL',
        confidence: 0.5,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'The 2pm one');

      expect(cancelAssistant.process).toHaveBeenCalled();
    });

    it('continues active reschedule flow even if intent changes', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        metadata: { aiRescheduleState: { state: 'IDENTIFY_BOOKING' } },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'GENERAL',
        confidence: 0.5,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'The afternoon one');

      expect(rescheduleAssistant.process).toHaveBeenCalled();
    });

    it('generates reply draft for GENERAL intent with autoReplySuggestions', async () => {
      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      expect(replyGenerator.generate).toHaveBeenCalled();
    });

    it('triggers summary every 5th message', async () => {
      prisma.message.count.mockResolvedValue(10);
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        metadata: {},
      } as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      expect(summaryGenerator.generate).toHaveBeenCalled();
    });

    it('does not trigger summary when not on 5th message', async () => {
      prisma.message.count.mockResolvedValue(7);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      // Summary generator should not be called for regular messages
      // (Only called via generateAndStoreSummary when messageCount % 5 === 0)
      expect(summaryGenerator.generate).not.toHaveBeenCalled();
    });

    it('handles TRANSFER_TO_HUMAN intent', async () => {
      intentDetector.detect.mockResolvedValue({
        intent: 'TRANSFER_TO_HUMAN',
        confidence: 0.95,
        extractedEntities: {},
      });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', name: 'Admin' } as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Talk to a human');

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedToId: 'staff1',
            metadata: expect.objectContaining({ transferredToHuman: true }),
          }),
        }),
      );
      expect(messageService.sendMessage).toHaveBeenCalledWith(
        'biz1',
        'conv1',
        'staff1',
        expect.stringContaining('connecting you'),
        'whatsapp',
      );
    });

    it('skips TRANSFER_TO_HUMAN if already transferred', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        metadata: { transferredToHuman: true },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'TRANSFER_TO_HUMAN',
        confidence: 0.9,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Talk to a human');

      // Should still generate a reply draft, not re-transfer
      expect(replyGenerator.generate).toHaveBeenCalled();
    });

    it('auto-replies when auto-reply is enabled and intent matches', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        aiSettings: {
          enabled: true,
          autoReplySuggestions: true,
          bookingAssistant: true,
          autoReply: { enabled: true, mode: 'all', selectedIntents: [] },
        },
      } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', name: 'Admin', role: 'ADMIN' } as any);
      replyGenerator.generate.mockResolvedValue({ draftText: 'Auto reply text' });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'What are your hours?');

      expect(messageService.sendMessage).toHaveBeenCalledWith(
        'biz1',
        'conv1',
        'staff1',
        'Auto reply text',
        'whatsapp',
      );
      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'ai:auto-replied',
        expect.objectContaining({ draftText: 'Auto reply text' }),
      );
    });

    it('does not auto-reply when transferredToHuman is true', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        aiSettings: {
          enabled: true,
          autoReplySuggestions: true,
          bookingAssistant: true,
          autoReply: { enabled: true, mode: 'all', selectedIntents: [] },
        },
      } as any);
      prisma.conversation.findUnique.mockResolvedValue({
        ...mockConversation,
        metadata: { transferredToHuman: true },
      } as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      // Should broadcast suggestions, not auto-reply
      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'ai:suggestions',
        expect.anything(),
      );
    });

    it('auto-replies only for selected intents when mode is "selected"', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        aiSettings: {
          enabled: true,
          autoReplySuggestions: true,
          bookingAssistant: true,
          autoReply: { enabled: true, mode: 'selected', selectedIntents: ['INQUIRY'] },
        },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'GENERAL',
        confidence: 0.8,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      // GENERAL is not in selectedIntents, so should not auto-reply
      expect(messageService.sendMessage).not.toHaveBeenCalled();
      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'ai:suggestions',
        expect.anything(),
      );
    });

    it('handles errors gracefully in processInboundMessage', async () => {
      intentDetector.detect.mockRejectedValue(new Error('AI service down'));

      // Should not throw
      await expect(
        aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello'),
      ).resolves.toBeUndefined();
    });

    it('does not call booking assistant when bookingAssistant is disabled', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        aiSettings: {
          enabled: true,
          autoReplySuggestions: true,
          bookingAssistant: false,
        },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.95,
        extractedEntities: {},
      });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'I want to book');

      expect(bookingAssistant.process).not.toHaveBeenCalled();
    });

    it('auto-confirms booking when auto-reply enabled and state is CONFIRM', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        aiSettings: {
          enabled: true,
          autoReplySuggestions: true,
          bookingAssistant: true,
          autoReply: { enabled: true, mode: 'all', selectedIntents: [] },
        },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'BOOK_APPOINTMENT',
        confidence: 0.95,
        extractedEntities: {},
      });
      bookingAssistant.process.mockResolvedValue({
        state: 'CONFIRM',
        serviceId: 'svc1',
        serviceName: 'Haircut',
        slotIso: '2026-03-01T14:00:00Z',
        date: '2026-03-01',
        time: '14:00',
        staffId: 'staff1',
        staffName: 'John',
        suggestedResponse: 'Confirm?',
      });
      // For confirmBooking
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        businessId: 'biz1',
        customerId: 'cust1',
        metadata: {
          aiBookingState: {
            state: 'CONFIRM',
            serviceId: 'svc1',
            slotIso: '2026-03-01T14:00:00Z',
          },
        },
      } as any);
      bookingService.create.mockResolvedValue({ id: 'booking1' } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', name: 'Admin', role: 'ADMIN' } as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Book me for 2pm');

      expect(bookingService.create).toHaveBeenCalled();
      expect(messageService.sendMessage).toHaveBeenCalledWith(
        'biz1',
        'conv1',
        'staff1',
        expect.stringContaining('confirmed'),
        'whatsapp',
      );
    });

    it('auto-confirms cancel when auto-reply enabled and state is CONFIRM_CANCEL', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        aiSettings: {
          enabled: true,
          autoReplySuggestions: true,
          bookingAssistant: true,
          autoReply: { enabled: true, mode: 'all', selectedIntents: [] },
        },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'CANCEL',
        confidence: 0.95,
        extractedEntities: {},
      });
      cancelAssistant.process.mockResolvedValue({
        state: 'CONFIRM_CANCEL',
        bookingId: 'booking1',
        serviceName: 'Haircut',
        suggestedResponse: 'Confirm cancel?',
      });
      // For confirmCancel
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        businessId: 'biz1',
        customerId: 'cust1',
        metadata: {
          aiCancelState: {
            state: 'CONFIRM_CANCEL',
            bookingId: 'booking1',
          },
        },
      } as any);
      bookingService.updateStatus.mockResolvedValue({ id: 'booking1', status: 'CANCELLED' } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', name: 'Admin', role: 'ADMIN' } as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Yes cancel it');

      expect(bookingService.updateStatus).toHaveBeenCalledWith('biz1', 'booking1', 'CANCELLED');
    });

    it('auto-confirms reschedule when auto-reply enabled', async () => {
      prisma.business.findUnique.mockResolvedValue({
        ...mockBusiness,
        aiSettings: {
          enabled: true,
          autoReplySuggestions: true,
          bookingAssistant: true,
          autoReply: { enabled: true, mode: 'all', selectedIntents: [] },
        },
      } as any);
      intentDetector.detect.mockResolvedValue({
        intent: 'RESCHEDULE',
        confidence: 0.95,
        extractedEntities: {},
      });
      rescheduleAssistant.process.mockResolvedValue({
        state: 'CONFIRM_RESCHEDULE',
        bookingId: 'booking1',
        newSlotIso: '2026-03-05T10:00:00Z',
        newDate: '2026-03-05',
        newTime: '10:00',
        suggestedResponse: 'Confirm reschedule?',
      });
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv1',
        businessId: 'biz1',
        customerId: 'cust1',
        metadata: {
          aiRescheduleState: {
            state: 'CONFIRM_RESCHEDULE',
            bookingId: 'booking1',
            newSlotIso: '2026-03-05T10:00:00Z',
          },
        },
      } as any);
      bookingService.update.mockResolvedValue({
        id: 'booking1',
        startTime: new Date('2026-03-05T10:00:00Z'),
      } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1', name: 'Admin', role: 'ADMIN' } as any);

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Yes reschedule');

      expect(bookingService.update).toHaveBeenCalledWith('biz1', 'booking1', {
        startTime: '2026-03-05T10:00:00Z',
      });
    });

    it('stores draft in message metadata when generated', async () => {
      replyGenerator.generate.mockResolvedValue({ draftText: 'Hello! How can I help?' });

      await aiService.processInboundMessage('biz1', 'conv1', 'msg1', 'Hello');

      // Second call to message.update stores the draft
      const updateCalls = prisma.message.update.mock.calls;
      const draftCall = updateCalls.find(
        (call: any) => call[0]?.data?.metadata?.ai?.draftText,
      );
      expect(draftCall).toBeDefined();
      expect((draftCall![0].data.metadata as any).ai.draftText).toBe('Hello! How can I help?');
    });
  });
});
