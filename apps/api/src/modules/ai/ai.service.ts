import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { ClaudeClient } from './claude.client';
import { IntentDetector, IntentResult } from './intent-detector';
import { ReplyGenerator, DraftReply } from './reply-generator';
import { BookingAssistant, BookingStateData } from './booking-assistant';
import { CancelAssistant, CancelStateData } from './cancel-assistant';
import { RescheduleAssistant, RescheduleStateData } from './reschedule-assistant';
import { SummaryGenerator } from './summary-generator';
import { ServiceService } from '../service/service.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookingService } from '../booking/booking.service';

interface AiSettings {
  enabled: boolean;
  autoReplySuggestions: boolean;
  bookingAssistant: boolean;
  personality: string;
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  autoReplySuggestions: true,
  bookingAssistant: true,
  personality: 'friendly and professional',
};

const MAX_AI_CALLS_PER_DAY = 500;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private dailyCalls = new Map<string, { count: number; date: string }>();

  constructor(
    private prisma: PrismaService,
    private inboxGateway: InboxGateway,
    private claude: ClaudeClient,
    private intentDetector: IntentDetector,
    private replyGenerator: ReplyGenerator,
    private bookingAssistant: BookingAssistant,
    private cancelAssistant: CancelAssistant,
    private rescheduleAssistant: RescheduleAssistant,
    private summaryGenerator: SummaryGenerator,
    private serviceService: ServiceService,
    private availabilityService: AvailabilityService,
    private bookingService: BookingService,
  ) {}

  private getAiSettings(business: any): AiSettings {
    const raw = business.aiSettings || {};
    return { ...DEFAULT_AI_SETTINGS, ...(typeof raw === 'object' ? raw : {}) };
  }

  private checkRateLimit(businessId: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    const entry = this.dailyCalls.get(businessId);
    if (!entry || entry.date !== today) {
      this.dailyCalls.set(businessId, { count: 1, date: today });
      return true;
    }
    if (entry.count >= MAX_AI_CALLS_PER_DAY) {
      this.logger.warn(`Business ${businessId} exceeded daily AI call limit`);
      return false;
    }
    entry.count++;
    return true;
  }

  private async getCustomerUpcomingBookings(customerId: string, businessId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        customerId,
        businessId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startTime: { gt: new Date() },
      },
      include: { service: true, staff: true },
      orderBy: { startTime: 'asc' },
    });
    return bookings.map((b: any) => ({
      id: b.id,
      serviceId: b.serviceId,
      serviceName: b.service?.name || '',
      date: b.startTime.toISOString().split('T')[0],
      time: b.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      staffId: b.staffId || undefined,
      staffName: b.staff?.name || undefined,
    }));
  }

  async processInboundMessage(
    businessId: string,
    conversationId: string,
    messageId: string,
    messageContent: string,
  ): Promise<void> {
    try {
      // Load business and check settings
      const business = await this.prisma.business.findUnique({ where: { id: businessId } });
      if (!business) return;

      const settings = this.getAiSettings(business);
      if (!settings.enabled) return;

      if (!this.claude.isAvailable()) {
        this.logger.warn('Claude client not available — skipping AI processing');
        return;
      }

      if (!this.checkRateLimit(businessId)) return;

      // Get recent messages for context
      const recentMessages = await this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      const recentContext = recentMessages
        .reverse()
        .slice(0, -1) // Exclude the current message
        .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Staff'}: ${m.content}`)
        .join('\n');

      // 1. Detect intent
      const intentResult = await this.intentDetector.detect(messageContent, recentContext || undefined);

      // Store intent in message metadata
      await this.prisma.message.update({
        where: { id: messageId },
        data: {
          metadata: {
            ai: {
              intent: intentResult.intent,
              confidence: intentResult.confidence,
              extractedEntities: intentResult.extractedEntities,
            },
          },
        },
      });

      // Load conversation metadata for active flow detection
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      const metadata = (conversation?.metadata as any) || {};

      // Flow priority: active state in metadata takes precedence over detected intent
      const hasActiveBooking = !!metadata.aiBookingState;
      const hasActiveCancel = !!metadata.aiCancelState;
      const hasActiveReschedule = !!metadata.aiRescheduleState;

      let bookingState: BookingStateData | null = null;
      let cancelState: CancelStateData | null = null;
      let rescheduleState: RescheduleStateData | null = null;
      let draftText = '';

      if (settings.bookingAssistant) {
        // Determine which flow to run based on active state or new intent
        if (hasActiveBooking) {
          bookingState = await this.runBookingAssistant(
            businessId, conversationId, messageContent, intentResult, business.name, settings.personality,
          );
        } else if (hasActiveCancel) {
          cancelState = await this.runCancelAssistant(
            businessId, conversationId, messageContent, business.name, settings.personality,
          );
        } else if (hasActiveReschedule) {
          rescheduleState = await this.runRescheduleAssistant(
            businessId, conversationId, messageContent, business.name, settings.personality,
          );
        } else if (intentResult.intent === 'BOOK_APPOINTMENT') {
          bookingState = await this.runBookingAssistant(
            businessId, conversationId, messageContent, intentResult, business.name, settings.personality,
          );
        } else if (intentResult.intent === 'CANCEL') {
          // Clear any other flow states before starting cancel
          await this.clearAllFlowStates(conversationId);
          cancelState = await this.runCancelAssistant(
            businessId, conversationId, messageContent, business.name, settings.personality,
          );
        } else if (intentResult.intent === 'RESCHEDULE') {
          // Clear any other flow states before starting reschedule
          await this.clearAllFlowStates(conversationId);
          rescheduleState = await this.runRescheduleAssistant(
            businessId, conversationId, messageContent, business.name, settings.personality,
          );
        }
      }

      // Use assistant's suggestedResponse as draft if available; otherwise generate a draft
      const assistantDraft = bookingState?.suggestedResponse
        || cancelState?.suggestedResponse
        || rescheduleState?.suggestedResponse;

      if (assistantDraft) {
        draftText = assistantDraft;
      } else if (settings.autoReplySuggestions) {
        const services = await this.serviceService.findAll(businessId);
        const activeServiceNames = services
          .filter((s: any) => s.isActive)
          .map((s: any) => s.name);

        const draft: DraftReply = await this.replyGenerator.generate(
          messageContent,
          intentResult.intent,
          business.name,
          settings.personality,
          recentContext || undefined,
          activeServiceNames,
        );
        draftText = draft.draftText;
      }

      // Store draft in message metadata
      if (draftText) {
        await this.prisma.message.update({
          where: { id: messageId },
          data: {
            metadata: {
              ai: {
                intent: intentResult.intent,
                confidence: intentResult.confidence,
                extractedEntities: intentResult.extractedEntities,
                draftText,
              },
            },
          },
        });
      }

      // Conversation summary (every 5th message)
      const messageCount = await this.prisma.message.count({ where: { conversationId } });
      if (messageCount % 5 === 0) {
        await this.generateAndStoreSummary(conversationId);
      }

      // Broadcast AI results via WebSocket
      this.inboxGateway.emitToBusinessRoom(businessId, 'ai:suggestions', {
        conversationId,
        messageId,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        draftText,
        bookingState,
        cancelState,
        rescheduleState,
      });
    } catch (error: any) {
      this.logger.error(`AI processing failed for message ${messageId}: ${error.message}`);
    }
  }

  private async runBookingAssistant(
    businessId: string,
    conversationId: string,
    messageContent: string,
    intentResult: IntentResult,
    businessName: string,
    personality: string,
  ): Promise<BookingStateData | null> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      const metadata = (conversation?.metadata as any) || {};
      const currentState: BookingStateData | null = metadata.aiBookingState || null;

      const services = await this.serviceService.findAll(businessId);
      const activeServices = services.filter((s: any) => s.isActive).map((s: any) => ({
        id: s.id,
        name: s.name,
        durationMins: s.durationMins,
        price: s.price,
        category: s.category,
      }));

      let availableSlots: any[] | undefined;
      const serviceId = currentState?.serviceId;
      const date = currentState?.date || intentResult.extractedEntities?.date;
      if (serviceId && date) {
        const slots = await this.availabilityService.getAvailableSlots(
          businessId, date, serviceId,
        );
        availableSlots = slots
          .filter((s) => s.available)
          .slice(0, 10)
          .map((s) => ({ time: s.time, display: s.display, staffId: s.staffId, staffName: s.staffName }));
      }

      const newState = await this.bookingAssistant.process(
        messageContent, currentState, {
          businessName, personality, services: activeServices,
          availableSlots, extractedEntities: intentResult.extractedEntities,
        },
      );

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { metadata: { ...metadata, aiBookingState: newState } },
      });

      return newState;
    } catch (error: any) {
      this.logger.error(`Booking assistant failed: ${error.message}`);
      return null;
    }
  }

  private async runCancelAssistant(
    businessId: string,
    conversationId: string,
    messageContent: string,
    businessName: string,
    personality: string,
  ): Promise<CancelStateData | null> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation) return null;
      const metadata = (conversation.metadata as any) || {};
      const currentState: CancelStateData | null = metadata.aiCancelState || null;

      const upcomingBookings = await this.getCustomerUpcomingBookings(conversation.customerId, businessId);

      const newState = await this.cancelAssistant.process(
        messageContent, currentState, {
          businessName, personality, upcomingBookings,
        },
      );

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { metadata: { ...metadata, aiCancelState: newState } },
      });

      return newState;
    } catch (error: any) {
      this.logger.error(`Cancel assistant failed: ${error.message}`);
      return null;
    }
  }

  private async runRescheduleAssistant(
    businessId: string,
    conversationId: string,
    messageContent: string,
    businessName: string,
    personality: string,
  ): Promise<RescheduleStateData | null> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation) return null;
      const metadata = (conversation.metadata as any) || {};
      const currentState: RescheduleStateData | null = metadata.aiRescheduleState || null;

      const upcomingBookings = await this.getCustomerUpcomingBookings(conversation.customerId, businessId);

      // Get available slots if we know the service and new date
      let availableSlots: any[] | undefined;
      if (currentState?.serviceId && currentState?.newDate) {
        const slots = await this.availabilityService.getAvailableSlots(
          businessId, currentState.newDate, currentState.serviceId,
        );
        availableSlots = slots
          .filter((s) => s.available)
          .slice(0, 10)
          .map((s) => ({ time: s.time, display: s.display, staffId: s.staffId, staffName: s.staffName }));
      }

      const newState = await this.rescheduleAssistant.process(
        messageContent, currentState, {
          businessName, personality, upcomingBookings, availableSlots,
        },
      );

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { metadata: { ...metadata, aiRescheduleState: newState } },
      });

      return newState;
    } catch (error: any) {
      this.logger.error(`Reschedule assistant failed: ${error.message}`);
      return null;
    }
  }

  private async clearAllFlowStates(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) return;
    const metadata = (conversation.metadata as any) || {};
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          ...metadata,
          aiBookingState: null,
          aiCancelState: null,
          aiRescheduleState: null,
        },
      },
    });
  }

  async generateAndStoreSummary(conversationId: string): Promise<string> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) return '';

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    const metadata = (conversation.metadata as any) || {};
    const existingSummary = metadata.aiSummary;

    const summary = await this.summaryGenerator.generate(
      messages.map((m) => ({
        direction: m.direction,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      existingSummary,
    );

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: { ...metadata, aiSummary: summary },
      },
    });

    return summary;
  }

  async confirmBooking(
    businessId: string,
    conversationId: string,
  ): Promise<any> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) throw new Error('Conversation not found');

    const metadata = (conversation.metadata as any) || {};
    const bookingState: BookingStateData | undefined = metadata.aiBookingState;
    if (!bookingState) throw new Error('No booking state found');
    if (bookingState.state !== 'CONFIRM') throw new Error('Booking not ready for confirmation');
    if (!bookingState.serviceId || !bookingState.slotIso) {
      throw new Error('Missing service or time slot');
    }

    const booking = await this.bookingService.create(businessId, {
      customerId: conversation.customerId,
      serviceId: bookingState.serviceId,
      staffId: bookingState.staffId,
      conversationId,
      startTime: bookingState.slotIso,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, aiBookingState: null } },
    });

    this.inboxGateway.notifyBookingUpdate(businessId, booking);
    return booking;
  }

  async clearBookingState(businessId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) return;

    const metadata = (conversation.metadata as any) || {};
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, aiBookingState: null } },
    });
  }

  async confirmCancel(
    businessId: string,
    conversationId: string,
  ): Promise<any> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) throw new Error('Conversation not found');

    const metadata = (conversation.metadata as any) || {};
    const cancelState: CancelStateData | undefined = metadata.aiCancelState;
    if (!cancelState) throw new Error('No cancel state found');
    if (cancelState.state !== 'CONFIRM_CANCEL') throw new Error('Cancel not ready for confirmation');
    if (!cancelState.bookingId) throw new Error('No booking identified');

    const booking = await this.bookingService.updateStatus(businessId, cancelState.bookingId, 'CANCELLED');

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, aiCancelState: null } },
    });

    this.inboxGateway.notifyBookingUpdate(businessId, booking);
    return booking;
  }

  async clearCancelState(businessId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) return;

    const metadata = (conversation.metadata as any) || {};
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, aiCancelState: null } },
    });
  }

  async confirmReschedule(
    businessId: string,
    conversationId: string,
  ): Promise<any> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) throw new Error('Conversation not found');

    const metadata = (conversation.metadata as any) || {};
    const rescheduleState: RescheduleStateData | undefined = metadata.aiRescheduleState;
    if (!rescheduleState) throw new Error('No reschedule state found');
    if (rescheduleState.state !== 'CONFIRM_RESCHEDULE') throw new Error('Reschedule not ready for confirmation');
    if (!rescheduleState.bookingId || !rescheduleState.newSlotIso) {
      throw new Error('Missing booking or new time slot');
    }

    const booking = await this.bookingService.update(businessId, rescheduleState.bookingId, {
      startTime: rescheduleState.newSlotIso,
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, aiRescheduleState: null } },
    });

    this.inboxGateway.notifyBookingUpdate(businessId, booking);
    return booking;
  }

  async clearRescheduleState(businessId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) return;

    const metadata = (conversation.metadata as any) || {};
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { metadata: { ...metadata, aiRescheduleState: null } },
    });
  }
}
