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
import { MessageService } from '../message/message.service';
import { MessagingService } from '../messaging/messaging.service';

interface AiSettings {
  enabled: boolean;
  autoReplySuggestions: boolean;
  bookingAssistant: boolean;
  personality: string;
  autoReply: {
    enabled: boolean;
    mode: 'all' | 'selected';
    selectedIntents: string[];
  };
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
  autoReplySuggestions: true,
  bookingAssistant: true,
  personality: 'friendly and professional',
  autoReply: {
    enabled: false,
    mode: 'all',
    selectedIntents: ['GENERAL', 'BOOK_APPOINTMENT', 'CANCEL', 'RESCHEDULE', 'INQUIRY'],
  },
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
    private messageService: MessageService,
    private messagingService: MessagingService,
  ) {}

  private getAiSettings(business: any): AiSettings {
    const raw = business.aiSettings || {};
    const merged = { ...DEFAULT_AI_SETTINGS, ...(typeof raw === 'object' ? raw : {}) };
    // Deep merge autoReply
    if (typeof raw === 'object' && raw.autoReply) {
      merged.autoReply = { ...DEFAULT_AI_SETTINGS.autoReply, ...raw.autoReply };
    }
    return merged;
  }

  private shouldAutoReplyForIntent(settings: AiSettings, intent: string): boolean {
    if (!settings.autoReply?.enabled) return false;
    if (settings.autoReply.mode === 'all') return true;
    return settings.autoReply.selectedIntents?.includes(intent) || false;
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

      // Load customer data for context
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      const customerData = conversation?.customerId
        ? await this.prisma.customer.findUnique({ where: { id: conversation.customerId } })
        : null;
      const upcomingBookings = customerData
        ? await this.getCustomerUpcomingBookings(customerData.id, businessId)
        : [];
      const customerContext = customerData
        ? {
            name: customerData.name,
            phone: customerData.phone,
            email: (customerData as any).email || undefined,
            tags: (customerData as any).tags || [],
            upcomingBookings,
          }
        : undefined;

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
            businessId, conversationId, messageContent, intentResult, business.name, settings.personality, customerContext,
          );
        } else if (hasActiveCancel) {
          cancelState = await this.runCancelAssistant(
            businessId, conversationId, messageContent, business.name, settings.personality, customerContext,
          );
        } else if (hasActiveReschedule) {
          rescheduleState = await this.runRescheduleAssistant(
            businessId, conversationId, messageContent, business.name, settings.personality, customerContext,
          );
        } else if (intentResult.intent === 'BOOK_APPOINTMENT') {
          bookingState = await this.runBookingAssistant(
            businessId, conversationId, messageContent, intentResult, business.name, settings.personality, customerContext,
          );
        } else if (intentResult.intent === 'CANCEL') {
          // Clear any other flow states before starting cancel
          await this.clearAllFlowStates(conversationId);
          cancelState = await this.runCancelAssistant(
            businessId, conversationId, messageContent, business.name, settings.personality, customerContext,
          );
        } else if (intentResult.intent === 'RESCHEDULE') {
          // Clear any other flow states before starting reschedule
          await this.clearAllFlowStates(conversationId);
          rescheduleState = await this.runRescheduleAssistant(
            businessId, conversationId, messageContent, business.name, settings.personality, customerContext,
          );
        }
      }

      // Handle transfer to human
      if (intentResult.intent === 'TRANSFER_TO_HUMAN' && !metadata.transferredToHuman) {
        await this.handleTransferToHuman(businessId, conversationId, metadata);
        return;
      }

      // Auto-reply + auto-confirm logic
      const isTransferred = !!metadata.transferredToHuman;
      const isAutoReplyEnabled = settings.autoReply?.enabled && !isTransferred;

      // Auto-confirm: when auto-reply enabled and booking/cancel/reschedule reaches final state
      if (isAutoReplyEnabled && bookingState?.state === 'CONFIRM' && bookingState.serviceId && bookingState.slotIso) {
        try {
          const booking = await this.confirmBooking(businessId, conversationId);
          const customerName = customerContext?.name || 'there';
          const confirmMsg = `Great news, ${customerName}! Your ${bookingState.serviceName} appointment has been confirmed for ${bookingState.date} at ${bookingState.time}${bookingState.staffName ? ` with ${bookingState.staffName}` : ''}. We look forward to seeing you! ✨`;
          const defaultStaff = await this.prisma.staff.findFirst({ where: { businessId, role: 'OWNER' } });
          if (defaultStaff) {
            const provider = this.messagingService.getProvider();
            await this.messageService.sendMessage(businessId, conversationId, defaultStaff.id, confirmMsg, provider);
          }
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:auto-replied', {
            conversationId, messageId, intent: 'BOOK_APPOINTMENT', draftText: confirmMsg,
          });
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:suggestions', {
            conversationId, messageId, intent: 'BOOK_APPOINTMENT',
            confidence: intentResult.confidence, draftText: '', bookingState: null, cancelState: null, rescheduleState: null,
          });
          return;
        } catch (err: any) {
          this.logger.error(`Auto-confirm booking failed: ${err.message}`);
          // Fall through to normal draft flow
        }
      }

      if (isAutoReplyEnabled && cancelState?.state === 'CONFIRM_CANCEL' && cancelState.bookingId) {
        try {
          await this.confirmCancel(businessId, conversationId);
          const customerName = customerContext?.name || 'there';
          const confirmMsg = `${customerName}, your ${cancelState.serviceName || ''} appointment has been cancelled. If you'd like to rebook in the future, just let us know!`;
          const defaultStaff = await this.prisma.staff.findFirst({ where: { businessId, role: 'OWNER' } });
          if (defaultStaff) {
            const provider = this.messagingService.getProvider();
            await this.messageService.sendMessage(businessId, conversationId, defaultStaff.id, confirmMsg, provider);
          }
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:auto-replied', {
            conversationId, messageId, intent: 'CANCEL', draftText: confirmMsg,
          });
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:suggestions', {
            conversationId, messageId, intent: 'CANCEL',
            confidence: intentResult.confidence, draftText: '', bookingState: null, cancelState: null, rescheduleState: null,
          });
          return;
        } catch (err: any) {
          this.logger.error(`Auto-confirm cancel failed: ${err.message}`);
        }
      }

      if (isAutoReplyEnabled && rescheduleState?.state === 'CONFIRM_RESCHEDULE' && rescheduleState.bookingId && rescheduleState.slotIso) {
        try {
          await this.confirmReschedule(businessId, conversationId);
          const customerName = customerContext?.name || 'there';
          const confirmMsg = `${customerName}, your appointment has been rescheduled to ${rescheduleState.newDate} at ${rescheduleState.newTime}. See you then! ✨`;
          const defaultStaff = await this.prisma.staff.findFirst({ where: { businessId, role: 'OWNER' } });
          if (defaultStaff) {
            const provider = this.messagingService.getProvider();
            await this.messageService.sendMessage(businessId, conversationId, defaultStaff.id, confirmMsg, provider);
          }
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:auto-replied', {
            conversationId, messageId, intent: 'RESCHEDULE', draftText: confirmMsg,
          });
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:suggestions', {
            conversationId, messageId, intent: 'RESCHEDULE',
            confidence: intentResult.confidence, draftText: '', bookingState: null, cancelState: null, rescheduleState: null,
          });
          return;
        } catch (err: any) {
          this.logger.error(`Auto-confirm reschedule failed: ${err.message}`);
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
          customerContext,
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

      // Auto-reply for non-action intents (general replies)
      const shouldAutoReply = draftText
        && isAutoReplyEnabled
        && this.shouldAutoReplyForIntent(settings, intentResult.intent);

      if (shouldAutoReply) {
        try {
          const defaultStaff = await this.prisma.staff.findFirst({
            where: { businessId, role: 'OWNER' },
          });
          if (defaultStaff) {
            const provider = this.messagingService.getProvider();
            await this.messageService.sendMessage(businessId, conversationId, defaultStaff.id, draftText, provider);
            this.inboxGateway.emitToBusinessRoom(businessId, 'ai:auto-replied', {
              conversationId,
              messageId,
              intent: intentResult.intent,
              draftText,
            });
          }
        } catch (err: any) {
          this.logger.error(`Auto-reply failed: ${err.message}`);
        }
      } else {
        // Broadcast AI results via WebSocket (draft mode)
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
      }
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
    customerContext?: any,
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

      let newState = await this.bookingAssistant.process(
        messageContent, currentState, {
          businessName, personality, services: activeServices,
          availableSlots, extractedEntities: intentResult.extractedEntities,
          customerContext,
        },
      );

      // Second pass: if the assistant advanced the state and we now have serviceId + date
      // but didn't reach CONFIRM (because slots weren't available during the first pass),
      // fetch slots and re-run so it can advance to CONFIRM in a single message round.
      if (
        newState.state !== 'CONFIRM'
        && newState.serviceId
        && newState.date
        && !availableSlots
      ) {
        const slots = await this.availabilityService.getAvailableSlots(
          businessId, newState.date, newState.serviceId,
        );
        const freshSlots = slots
          .filter((s) => s.available)
          .slice(0, 10)
          .map((s) => ({ time: s.time, display: s.display, staffId: s.staffId, staffName: s.staffName }));

        if (freshSlots.length > 0) {
          // If the customer already specified a time, try to match it to a slot
          const requestedTime = newState.time;
          if (requestedTime) {
            // Match against display format (e.g., "14:00") since slot.time is ISO
            const matchedSlot = freshSlots.find((s) => s.display === requestedTime);
            if (matchedSlot) {
              // Directly advance to CONFIRM with the matched slot
              newState = {
                ...newState,
                state: 'CONFIRM',
                staffId: matchedSlot.staffId,
                staffName: matchedSlot.staffName,
                slotIso: matchedSlot.time, // ISO string from availability service
                suggestedResponse: `Great news, ${customerContext?.name || 'there'}! Your ${newState.serviceName} appointment is confirmed for ${newState.date} at ${matchedSlot.display} with ${matchedSlot.staffName}. We look forward to seeing you!`,
              };
            } else {
              // Time doesn't match available slots — re-run with slots to suggest alternatives
              newState = await this.bookingAssistant.process(
                `The customer wants ${requestedTime} but here are the available slots. Please suggest alternatives.`,
                newState, {
                  businessName, personality, services: activeServices,
                  availableSlots: freshSlots, extractedEntities: intentResult.extractedEntities,
                  customerContext,
                },
              );
            }
          } else {
            // No time specified — re-run with slots so AI can suggest options
            newState = await this.bookingAssistant.process(
              messageContent, newState, {
                businessName, personality, services: activeServices,
                availableSlots: freshSlots, extractedEntities: intentResult.extractedEntities,
                customerContext,
              },
            );
          }
        }
      }

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
    customerContext?: any,
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
          customerContext,
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
    customerContext?: any,
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
          customerContext,
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

  private async handleTransferToHuman(
    businessId: string,
    conversationId: string,
    metadata: any,
  ): Promise<void> {
    try {
      // Find default staff (owner)
      const defaultStaff = await this.prisma.staff.findFirst({
        where: { businessId, role: 'OWNER' },
      });
      if (!defaultStaff) {
        this.logger.warn('No owner staff found for transfer');
        return;
      }

      // Assign conversation to staff and mark as transferred
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          assignedToId: defaultStaff.id,
          metadata: { ...metadata, transferredToHuman: true },
        },
      });

      // Auto-send handoff message
      const handoffMessage = "I'm connecting you with a team member who can help you further.";
      const provider = this.messagingService.getProvider();
      await this.messageService.sendMessage(businessId, conversationId, defaultStaff.id, handoffMessage, provider);

      // Broadcast transfer event
      this.inboxGateway.emitToBusinessRoom(businessId, 'ai:transferred', {
        conversationId,
        assignedTo: { id: defaultStaff.id, name: defaultStaff.name },
      });
    } catch (error: any) {
      this.logger.error(`Transfer to human failed: ${error.message}`);
    }
  }

  async resumeAutoReply(businessId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) return;

    const metadata = (conversation.metadata as any) || {};
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        metadata: { ...metadata, transferredToHuman: false },
      },
    });
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
