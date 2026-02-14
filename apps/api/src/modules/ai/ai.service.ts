import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { ClaudeClient } from './claude.client';
import { IntentDetector, IntentResult } from './intent-detector';
import { ReplyGenerator, ReplySuggestion } from './reply-generator';
import { BookingAssistant, BookingStateData } from './booking-assistant';
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

      // 2. Generate reply suggestions
      let suggestions: ReplySuggestion[] = [];
      if (settings.autoReplySuggestions) {
        const services = await this.serviceService.findAll(businessId);
        const activeServiceNames = services
          .filter((s: any) => s.isActive)
          .map((s: any) => s.name);

        suggestions = await this.replyGenerator.generate(
          messageContent,
          intentResult.intent,
          business.name,
          settings.personality,
          recentContext || undefined,
          activeServiceNames,
        );

        // Store suggestions in message metadata
        await this.prisma.message.update({
          where: { id: messageId },
          data: {
            metadata: {
              ai: {
                intent: intentResult.intent,
                confidence: intentResult.confidence,
                extractedEntities: intentResult.extractedEntities,
                suggestions: suggestions.map((s) => s.text),
              },
            },
          },
        });
      }

      // 3. Booking assistant (if intent is BOOK_APPOINTMENT)
      let bookingState: BookingStateData | null = null;
      if (settings.bookingAssistant && intentResult.intent === 'BOOK_APPOINTMENT') {
        bookingState = await this.runBookingAssistant(
          businessId,
          conversationId,
          messageContent,
          intentResult,
          business.name,
          settings.personality,
        );
      }

      // 4. Conversation summary (every 5th message)
      const messageCount = await this.prisma.message.count({ where: { conversationId } });
      if (messageCount % 5 === 0) {
        await this.generateAndStoreSummary(conversationId);
      }

      // 5. Broadcast AI results via WebSocket
      this.inboxGateway.emitToBusinessRoom(businessId, 'ai:suggestions', {
        conversationId,
        messageId,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        suggestions: suggestions.map((s) => s.text),
        bookingState,
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
      // Get current booking state from conversation metadata
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      const metadata = (conversation?.metadata as any) || {};
      const currentState: BookingStateData | null = metadata.aiBookingState || null;

      // Get services
      const services = await this.serviceService.findAll(businessId);
      const activeServices = services.filter((s: any) => s.isActive).map((s: any) => ({
        id: s.id,
        name: s.name,
        durationMins: s.durationMins,
        price: s.price,
        category: s.category,
      }));

      // Get available slots if we know the service and date
      let availableSlots: any[] | undefined;
      const serviceId = currentState?.serviceId;
      const date = currentState?.date || intentResult.extractedEntities?.date;
      if (serviceId && date) {
        const slots = await this.availabilityService.getAvailableSlots(
          businessId,
          date,
          serviceId,
        );
        availableSlots = slots
          .filter((s) => s.available)
          .slice(0, 10)
          .map((s) => ({
            time: s.time,
            display: s.display,
            staffId: s.staffId,
            staffName: s.staffName,
          }));
      }

      const newState = await this.bookingAssistant.process(
        messageContent,
        currentState,
        {
          businessName,
          personality,
          services: activeServices,
          availableSlots,
          extractedEntities: intentResult.extractedEntities,
        },
      );

      // Store booking state in conversation metadata
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          metadata: {
            ...metadata,
            aiBookingState: newState,
          },
        },
      });

      return newState;
    } catch (error: any) {
      this.logger.error(`Booking assistant failed: ${error.message}`);
      return null;
    }
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

    // Clear booking state
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: { ...metadata, aiBookingState: null },
      },
    });

    // Notify
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
      data: {
        metadata: { ...metadata, aiBookingState: null },
      },
    });
  }
}
