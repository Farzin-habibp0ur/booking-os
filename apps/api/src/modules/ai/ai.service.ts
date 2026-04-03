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
import { ProfileCollector } from './profile-collector';
import { checkProfileCompleteness } from '@booking-os/shared';
import { ServiceService } from '../service/service.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookingService } from '../booking/booking.service';
import { MessageService } from '../message/message.service';
import { MessagingService } from '../messaging/messaging.service';
import { ConversationActionHandler } from './conversation-action-handler';
import { OutboundService } from '../outbound/outbound.service';
import { PortalRedisService } from '../../common/portal-redis.service';

interface ChannelOverride {
  enabled: boolean;
}

interface ChannelValidationResult {
  allowed: boolean;
  reason?: string;
  fallbackToDraft: boolean;
}

interface AiSettings {
  enabled: boolean;
  autoReplySuggestions: boolean;
  bookingAssistant: boolean;
  personality: string;
  autoReply: {
    enabled: boolean;
    mode: 'all' | 'selected';
    selectedIntents: string[];
    channelOverrides?: Record<string, ChannelOverride>;
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
    channelOverrides: {},
  },
};

const MAX_AI_CALLS_PER_DAY = 500;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

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
    private profileCollector: ProfileCollector,
    private serviceService: ServiceService,
    private availabilityService: AvailabilityService,
    private bookingService: BookingService,
    private messageService: MessageService,
    private messagingService: MessagingService,
    private conversationActionHandler: ConversationActionHandler,
    private outboundService: OutboundService,
    private redis: PortalRedisService,
  ) {}

  private async getProviderForConversation(conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        location: {
          select: {
            whatsappConfig: true,
            instagramConfig: true,
            facebookConfig: true,
            emailConfig: true,
          },
        },
      },
    });
    const loc = conv?.location as any;
    return this.messagingService.getProviderForConversation(
      conv?.channel || 'WHATSAPP',
      loc?.instagramConfig || null,
      loc?.whatsappConfig || null,
      loc?.facebookConfig || null,
      loc?.emailConfig || null,
    );
  }

  private getAiSettings(business: any): AiSettings {
    const raw = business.aiSettings || {};
    const merged = { ...DEFAULT_AI_SETTINGS, ...(typeof raw === 'object' ? raw : {}) };
    // Deep merge autoReply
    if (typeof raw === 'object' && raw.autoReply) {
      merged.autoReply = {
        ...DEFAULT_AI_SETTINGS.autoReply,
        ...raw.autoReply,
        channelOverrides: { ...raw.autoReply.channelOverrides },
      };
    }
    return merged;
  }

  private shouldAutoReplyForIntent(settings: AiSettings, intent: string): boolean {
    if (!settings.autoReply?.enabled) return false;
    if (settings.autoReply.mode === 'all') return true;
    return settings.autoReply.selectedIntents?.includes(intent) || false;
  }

  private isAutoReplyEnabledForChannel(settings: AiSettings, channel: string): boolean {
    const overrides = settings.autoReply?.channelOverrides;
    if (!overrides || !overrides[channel]) return true; // inherit global setting
    return overrides[channel].enabled;
  }

  private async validateChannelForAutoReply(
    conversationId: string,
    channel: string,
    draftText: string,
    customer: any,
  ): Promise<ChannelValidationResult> {
    const ch = channel.toUpperCase();

    if (ch === 'INSTAGRAM') {
      const withinWindow = await this.isWithinMessagingWindow(conversationId);
      if (!withinWindow) {
        this.logger.log(`Channel validation: INSTAGRAM window expired for ${conversationId}`);
        return {
          allowed: false,
          reason: 'Instagram 24h messaging window expired',
          fallbackToDraft: true,
        };
      }
      if (draftText.length > 1000) {
        this.logger.log(
          `Channel validation: INSTAGRAM message too long (${draftText.length} chars)`,
        );
        return {
          allowed: false,
          reason: 'Instagram message exceeds 1000 characters',
          fallbackToDraft: true,
        };
      }
    }

    if (ch === 'FACEBOOK') {
      const withinWindow = await this.isWithinMessagingWindow(conversationId);
      if (!withinWindow) {
        this.logger.log(`Channel validation: FACEBOOK window expired for ${conversationId}`);
        return {
          allowed: false,
          reason: 'Facebook 24h messaging window expired',
          fallbackToDraft: true,
        };
      }
    }

    if (ch === 'WHATSAPP') {
      const withinWindow = await this.isWithinMessagingWindow(conversationId);
      if (!withinWindow) {
        this.logger.log(`Channel validation: WHATSAPP window expired for ${conversationId}`);
        return {
          allowed: false,
          reason: 'WhatsApp 24h window expired — template required',
          fallbackToDraft: true,
        };
      }
    }

    if (ch === 'SMS') {
      const customFields = (customer?.customFields as any) || {};
      if (customFields.smsOptOut) {
        this.logger.log(`Channel validation: SMS opt-out for customer ${customer?.id}`);
        return { allowed: false, reason: 'Customer opted out of SMS', fallbackToDraft: false };
      }
      if (draftText.length > 320) {
        this.logger.log(
          `Channel validation: SMS too long (${draftText.length} chars), switching to draft`,
        );
        return {
          allowed: false,
          reason: 'SMS exceeds 2-segment limit (320 chars)',
          fallbackToDraft: true,
        };
      }
    }

    this.logger.debug(`Channel validation: ${ch} PASSED for ${conversationId}`);
    return { allowed: true, fallbackToDraft: false };
  }

  private async isWithinMessagingWindow(conversationId: string): Promise<boolean> {
    const lastInbound = await this.prisma.message.findFirst({
      where: { conversationId, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (!lastInbound) return false;
    const hoursSinceLastInbound = (Date.now() - lastInbound.createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastInbound < 24;
  }

  private async checkRateLimit(businessId: string): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const redisKey = `ai:daily:${businessId}:${today}`;

    // Atomic increment — shared across all instances, survives restarts
    const count = await this.redis.incr(redisKey, 86400000);

    if (count > MAX_AI_CALLS_PER_DAY) {
      this.logger.warn(`Business ${businessId} exceeded daily AI call limit`);
      return false;
    }

    // Persist to DB for historical reporting (fire-and-forget)
    this.persistAiUsage(businessId, count, today);
    return true;
  }

  private persistAiUsage(businessId: string, count: number, date: string) {
    // Fire-and-forget: upsert usage to dedicated AiUsage table
    this.prisma.aiUsage
      .upsert({
        where: { businessId_date: { businessId, date } },
        update: { count },
        create: { businessId, date, count },
      })
      .catch((err) => {
        this.logger.error(`Failed to persist AI usage: ${err.message}`);
      });
  }

  async getAiUsage(businessId: string): Promise<{ count: number; date: string; limit: number }> {
    const today = new Date().toISOString().split('T')[0];
    const redisKey = `ai:daily:${businessId}:${today}`;

    // Try Redis first (shared counter)
    const redisVal = await this.redis.get(redisKey);
    if (redisVal !== null) {
      return { count: parseInt(redisVal, 10), date: today, limit: MAX_AI_CALLS_PER_DAY };
    }

    // Fallback to DB
    const dbRecord = await this.prisma.aiUsage.findUnique({
      where: { businessId_date: { businessId, date: today } },
    });

    return { count: dbRecord?.count ?? 0, date: today, limit: MAX_AI_CALLS_PER_DAY };
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

      if (!(await this.checkRateLimit(businessId))) return;

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

      // Load customer data and channel context
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      const conversationChannel = (conversation as any)?.channel || 'WHATSAPP';
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
      const intentResult = await this.intentDetector.detect(
        messageContent,
        recentContext || undefined,
      );

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
      let goto_draft = false;
      let profileJustCollected = false;

      if (settings.bookingAssistant) {
        // Determine which flow to run based on active state or new intent
        if (hasActiveBooking && metadata.aiBookingState?.state === 'COLLECT_PROFILE') {
          // Handle profile collection flow
          bookingState = await this.handleProfileCollection(
            businessId,
            conversationId,
            messageContent,
            business,
            settings,
            customerData,
            customerContext,
          );
          if (bookingState?.state === 'CONFIRM') profileJustCollected = true;
        } else if (hasActiveBooking) {
          bookingState = await this.runBookingAssistant(
            businessId,
            conversationId,
            messageContent,
            intentResult,
            business.name,
            settings.personality,
            customerContext,
          );
        } else if (hasActiveCancel) {
          cancelState = await this.runCancelAssistant(
            businessId,
            conversationId,
            messageContent,
            business.name,
            settings.personality,
            customerContext,
          );
        } else if (hasActiveReschedule) {
          rescheduleState = await this.runRescheduleAssistant(
            businessId,
            conversationId,
            messageContent,
            business.name,
            settings.personality,
            customerContext,
          );
        } else if (intentResult.intent === 'BOOK_APPOINTMENT') {
          bookingState = await this.runBookingAssistant(
            businessId,
            conversationId,
            messageContent,
            intentResult,
            business.name,
            settings.personality,
            customerContext,
          );
        } else if (intentResult.intent === 'CANCEL') {
          // Clear any other flow states before starting cancel
          await this.clearAllFlowStates(conversationId);
          cancelState = await this.runCancelAssistant(
            businessId,
            conversationId,
            messageContent,
            business.name,
            settings.personality,
            customerContext,
          );
        } else if (intentResult.intent === 'RESCHEDULE') {
          // Clear any other flow states before starting reschedule
          await this.clearAllFlowStates(conversationId);
          rescheduleState = await this.runRescheduleAssistant(
            businessId,
            conversationId,
            messageContent,
            business.name,
            settings.personality,
            customerContext,
          );
        }
      }

      // Build context for action card generation
      const actionCtx = {
        businessId,
        conversationId,
        customerId: customerData?.id,
        customerName: customerData?.name,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
      };

      // Handle transfer to human
      if (intentResult.intent === 'TRANSFER_TO_HUMAN' && !metadata.transferredToHuman) {
        await this.handleTransferToHuman(businessId, conversationId, metadata);
        this.conversationActionHandler
          .handleTransferToHuman(actionCtx)
          .catch((err) =>
            this.logger.warn(`Failed to create transfer action card: ${err?.message}`),
          );
        return;
      }

      // Auto-reply + auto-confirm logic
      const isTransferred = !!metadata.transferredToHuman;
      const isAutoReplyEnabled = settings.autoReply?.enabled && !isTransferred;

      // Auto-confirm: when auto-reply enabled and booking/cancel/reschedule reaches final state
      if (
        isAutoReplyEnabled &&
        bookingState?.state === 'CONFIRM' &&
        bookingState.serviceId &&
        bookingState.slotIso
      ) {
        // Check profile completeness before auto-confirming (skip if profile was just collected)
        const requiredFields: string[] = (business.packConfig as any)?.requiredProfileFields || [];
        if (!profileJustCollected && requiredFields.length > 0 && customerData) {
          const { missingFields } = checkProfileCompleteness(
            {
              name: customerData.name,
              email: (customerData as any).email,
              customFields: (customerData as any).customFields || {},
            },
            requiredFields,
          );

          if (missingFields.length > 0) {
            // Transition to COLLECT_PROFILE instead of auto-confirming
            const result = await this.profileCollector.collect(messageContent, {
              customerName: customerData.name,
              businessName: business.name,
              personality: settings.personality,
              missingFields,
              alreadyCollected: {},
            });
            const updatedBookingState: BookingStateData = {
              ...bookingState,
              state: 'COLLECT_PROFILE',
              missingFields: result.missingFields,
              collectedFields: result.collectedFields,
              suggestedResponse: result.suggestedResponse,
            };
            const convMeta = (conversation?.metadata as any) || {};
            await this.prisma.conversation.update({
              where: { id: conversationId },
              data: { metadata: { ...convMeta, aiBookingState: updatedBookingState } },
            });
            bookingState = updatedBookingState;
            // Fall through to draft flow with the profile collector's suggested response
            draftText = result.suggestedResponse;
            // Skip the normal auto-confirm, continue to draft/auto-reply below
            goto_draft = true;
          }
        }
        if (!goto_draft) {
          try {
            const booking = await this.confirmBooking(businessId, conversationId);
            const customerName = customerContext?.name || 'there';
            const confirmMsg = `Great news, ${customerName}! Your ${bookingState.serviceName} appointment has been confirmed for ${bookingState.date} at ${bookingState.time}${bookingState.staffName ? ` with ${bookingState.staffName}` : ''}. We look forward to seeing you! ✨`;
            const defaultStaff = await this.prisma.staff.findFirst({
              where: { businessId, role: 'ADMIN' },
            });
            if (defaultStaff) {
              const provider = await this.getProviderForConversation(conversationId);
              await this.messageService.sendMessage(
                businessId,
                conversationId,
                defaultStaff.id,
                confirmMsg,
                provider,
              );
            }
            this.inboxGateway.emitToBusinessRoom(businessId, 'ai:auto-replied', {
              conversationId,
              messageId,
              intent: 'BOOK_APPOINTMENT',
              draftText: confirmMsg,
            });
            this.inboxGateway.emitToBusinessRoom(businessId, 'ai:suggestions', {
              conversationId,
              messageId,
              intent: 'BOOK_APPOINTMENT',
              confidence: intentResult.confidence,
              draftText: '',
              bookingState: null,
              cancelState: null,
              rescheduleState: null,
            });
            return;
          } catch (err: any) {
            this.logger.error(`Auto-confirm booking failed: ${err.message}`);
            // Fall through to normal draft flow
          }
        }
      }

      if (isAutoReplyEnabled && cancelState?.state === 'CONFIRM_CANCEL' && cancelState.bookingId) {
        try {
          await this.confirmCancel(businessId, conversationId);
          const customerName = customerContext?.name || 'there';
          const confirmMsg = `${customerName}, your ${cancelState.serviceName || ''} appointment has been cancelled. If you'd like to rebook in the future, just let us know!`;
          const defaultStaff = await this.prisma.staff.findFirst({
            where: { businessId, role: 'ADMIN' },
          });
          if (defaultStaff) {
            const provider = await this.getProviderForConversation(conversationId);
            await this.messageService.sendMessage(
              businessId,
              conversationId,
              defaultStaff.id,
              confirmMsg,
              provider,
            );
          }
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:auto-replied', {
            conversationId,
            messageId,
            intent: 'CANCEL',
            draftText: confirmMsg,
          });
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:suggestions', {
            conversationId,
            messageId,
            intent: 'CANCEL',
            confidence: intentResult.confidence,
            draftText: '',
            bookingState: null,
            cancelState: null,
            rescheduleState: null,
          });
          return;
        } catch (err: any) {
          this.logger.error(`Auto-confirm cancel failed: ${err.message}`);
        }
      }

      if (
        isAutoReplyEnabled &&
        rescheduleState?.state === 'CONFIRM_RESCHEDULE' &&
        rescheduleState.bookingId &&
        rescheduleState.newSlotIso
      ) {
        try {
          await this.confirmReschedule(businessId, conversationId);
          const customerName = customerContext?.name || 'there';
          const confirmMsg = `${customerName}, your appointment has been rescheduled to ${rescheduleState.newDate} at ${rescheduleState.newTime}. See you then! ✨`;
          const defaultStaff = await this.prisma.staff.findFirst({
            where: { businessId, role: 'ADMIN' },
          });
          if (defaultStaff) {
            const provider = await this.getProviderForConversation(conversationId);
            await this.messageService.sendMessage(
              businessId,
              conversationId,
              defaultStaff.id,
              confirmMsg,
              provider,
            );
          }
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:auto-replied', {
            conversationId,
            messageId,
            intent: 'RESCHEDULE',
            draftText: confirmMsg,
          });
          this.inboxGateway.emitToBusinessRoom(businessId, 'ai:suggestions', {
            conversationId,
            messageId,
            intent: 'RESCHEDULE',
            confidence: intentResult.confidence,
            draftText: '',
            bookingState: null,
            cancelState: null,
            rescheduleState: null,
          });
          return;
        } catch (err: any) {
          this.logger.error(`Auto-confirm reschedule failed: ${err.message}`);
        }
      }

      // Detect Instagram-specific context from message metadata
      const currentMessage = await this.prisma.message.findUnique({ where: { id: messageId } });
      const msgMetadata = (currentMessage?.metadata as any) || {};
      let instagramContext = '';
      if (conversationChannel === 'INSTAGRAM') {
        if (msgMetadata.storyReplyUrl) {
          instagramContext =
            '\nThis message is a reply to an Instagram Story. Acknowledge the story and engage warmly.';
        } else if (msgMetadata.referral) {
          instagramContext =
            '\nThis customer came from an Instagram ad. Welcome them and reference the promotion if applicable.';
        } else if (msgMetadata.postback) {
          instagramContext = `\nThe customer tapped an ice breaker: "${msgMetadata.postback}". Respond directly to this topic.`;
          // Treat ice breaker taps as booking intent when relevant
          if (intentResult.intent === 'GENERAL' || intentResult.intent === 'INQUIRY') {
            intentResult.intent = 'BOOK_APPOINTMENT';
          }
        }
      }

      // Use assistant's suggestedResponse as draft if available; otherwise generate a draft
      const assistantDraft =
        bookingState?.suggestedResponse ||
        cancelState?.suggestedResponse ||
        rescheduleState?.suggestedResponse;

      if (assistantDraft) {
        draftText = assistantDraft;
      } else if (settings.autoReplySuggestions) {
        const services = await this.serviceService.findAll(businessId);
        const activeServiceNames = services.filter((s: any) => s.isActive).map((s: any) => s.name);

        // Add channel context for the reply generator
        let channelContext = '';
        if (conversationChannel === 'INSTAGRAM') {
          channelContext = `\nThis conversation is on Instagram DM. Keep replies concise (under 1000 chars), avoid referencing message templates, and use a casual friendly tone.`;
          channelContext += instagramContext;
        }

        const draft: DraftReply = await this.replyGenerator.generate(
          messageContent,
          intentResult.intent,
          business.name,
          settings.personality,
          (recentContext || '') + channelContext || undefined,
          activeServiceNames,
          customerContext,
          conversationChannel,
        );
        draftText = draft.draftText;
      }

      // Enforce Instagram 1000-char limit on AI drafts
      if (conversationChannel === 'INSTAGRAM' && draftText && draftText.length > 1000) {
        draftText = draftText.slice(0, 997) + '...';
      }

      // Store draft in message metadata + create OutboundDraft record
      let outboundDraftId: string | undefined;

      if (draftText) {
        // Create OutboundDraft for non-auto-reply path (Prompt 1)
        const willAutoReply =
          isAutoReplyEnabled &&
          this.shouldAutoReplyForIntent(settings, intentResult.intent) &&
          this.isAutoReplyEnabledForChannel(settings, conversationChannel);

        if (!willAutoReply && conversation?.customerId) {
          try {
            const defaultStaff = await this.prisma.staff.findFirst({
              where: { businessId, role: 'ADMIN' },
            });
            if (defaultStaff) {
              const draft = await this.outboundService.createAiDraft({
                businessId,
                customerId: conversation.customerId,
                staffId: defaultStaff.id,
                conversationId,
                channel: conversationChannel,
                content: draftText,
                sourceMessageId: messageId,
                intent: intentResult.intent,
                confidence: intentResult.confidence,
                metadata: {
                  intent: intentResult.intent,
                  entities: intentResult.extractedEntities,
                  generatedAt: new Date().toISOString(),
                },
              });
              outboundDraftId = draft.id;
            }
          } catch (err: any) {
            this.logger.warn(`Failed to create OutboundDraft: ${err.message}`);
          }
        }

        // Backward compat: still store in message metadata
        await this.prisma.message.update({
          where: { id: messageId },
          data: {
            metadata: {
              ai: {
                intent: intentResult.intent,
                confidence: intentResult.confidence,
                extractedEntities: intentResult.extractedEntities,
                draftText,
                ...(outboundDraftId ? { outboundDraftId } : {}),
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

      // Auto-reply for non-action intents (general replies) — with channel validation
      const shouldAutoReply =
        draftText &&
        isAutoReplyEnabled &&
        this.shouldAutoReplyForIntent(settings, intentResult.intent) &&
        this.isAutoReplyEnabledForChannel(settings, conversationChannel);

      let autoReplySent = false;

      if (shouldAutoReply) {
        // Validate channel constraints before sending
        const validation = await this.validateChannelForAutoReply(
          conversationId,
          conversationChannel,
          draftText,
          customerData,
        );

        if (validation.allowed) {
          try {
            const defaultStaff = await this.prisma.staff.findFirst({
              where: { businessId, role: 'ADMIN' },
            });
            if (defaultStaff) {
              const provider = await this.getProviderForConversation(conversationId);
              await this.messageService.sendMessage(
                businessId,
                conversationId,
                defaultStaff.id,
                draftText,
                provider,
              );
              this.inboxGateway.emitToBusinessRoom(businessId, 'ai:auto-replied', {
                conversationId,
                messageId,
                intent: intentResult.intent,
                draftText,
              });
              autoReplySent = true;
            }
          } catch (err: any) {
            this.logger.error(`Auto-reply failed: ${err.message}`);
          }
        } else if (validation.fallbackToDraft && conversation?.customerId && !outboundDraftId) {
          // Channel validation failed — create draft instead
          this.logger.log(
            `Auto-reply blocked for ${conversationChannel}: ${validation.reason}. Creating draft.`,
          );
          try {
            const defaultStaff = await this.prisma.staff.findFirst({
              where: { businessId, role: 'ADMIN' },
            });
            if (defaultStaff) {
              const draft = await this.outboundService.createAiDraft({
                businessId,
                customerId: conversation.customerId,
                staffId: defaultStaff.id,
                conversationId,
                channel: conversationChannel,
                content: draftText,
                sourceMessageId: messageId,
                intent: intentResult.intent,
                confidence: intentResult.confidence,
                metadata: {
                  intent: intentResult.intent,
                  entities: intentResult.extractedEntities,
                  channelValidationReason: validation.reason,
                  generatedAt: new Date().toISOString(),
                },
              });
              outboundDraftId = draft.id;
            }
          } catch (err: any) {
            this.logger.warn(`Failed to create fallback OutboundDraft: ${err.message}`);
          }
        } else {
          this.logger.log(`Auto-reply skipped for ${conversationChannel}: ${validation.reason}`);
        }
      }

      if (!autoReplySent) {
        // Create action cards for states needing staff approval (non-auto-reply path)
        if (bookingState) {
          this.conversationActionHandler
            .handleBookingState(actionCtx, bookingState)
            .catch((err) =>
              this.logger.warn(`Failed to create booking action card: ${err?.message}`),
            );
        }
        if (cancelState) {
          this.conversationActionHandler
            .handleCancelState(actionCtx, cancelState)
            .catch((err) =>
              this.logger.warn(`Failed to create cancel action card: ${err?.message}`),
            );
        }
        if (rescheduleState) {
          this.conversationActionHandler
            .handleRescheduleState(actionCtx, rescheduleState)
            .catch((err) =>
              this.logger.warn(`Failed to create reschedule action card: ${err?.message}`),
            );
        }
        // Low confidence review card
        this.conversationActionHandler
          .handleLowConfidence(actionCtx)
          .catch((err) =>
            this.logger.warn(`Failed to create low-confidence card: ${err?.message}`),
          );

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
      const activeServices = services
        .filter((s: any) => s.isActive)
        .map((s: any) => ({
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
        const slots = await this.availabilityService.getAvailableSlots(businessId, date, serviceId);
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

      let newState = await this.bookingAssistant.process(messageContent, currentState, {
        businessName,
        personality,
        services: activeServices,
        availableSlots,
        extractedEntities: intentResult.extractedEntities,
        customerContext,
      });

      // Second pass: if the assistant advanced the state and we now have serviceId + date
      // but didn't reach CONFIRM (because slots weren't available during the first pass),
      // fetch slots and re-run so it can advance to CONFIRM in a single message round.
      if (newState.state !== 'CONFIRM' && newState.serviceId && newState.date && !availableSlots) {
        const slots = await this.availabilityService.getAvailableSlots(
          businessId,
          newState.date,
          newState.serviceId,
        );
        const freshSlots = slots
          .filter((s) => s.available)
          .slice(0, 10)
          .map((s) => ({
            time: s.time,
            display: s.display,
            staffId: s.staffId,
            staffName: s.staffName,
          }));

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
                newState,
                {
                  businessName,
                  personality,
                  services: activeServices,
                  availableSlots: freshSlots,
                  extractedEntities: intentResult.extractedEntities,
                  customerContext,
                },
              );
            }
          } else {
            // No time specified — re-run with slots so AI can suggest options
            newState = await this.bookingAssistant.process(messageContent, newState, {
              businessName,
              personality,
              services: activeServices,
              availableSlots: freshSlots,
              extractedEntities: intentResult.extractedEntities,
              customerContext,
            });
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

      const upcomingBookings = await this.getCustomerUpcomingBookings(
        conversation.customerId,
        businessId,
      );

      const newState = await this.cancelAssistant.process(messageContent, currentState, {
        businessName,
        personality,
        upcomingBookings,
        customerContext,
      });

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

      const upcomingBookings = await this.getCustomerUpcomingBookings(
        conversation.customerId,
        businessId,
      );

      // Get available slots if we know the service and new date
      let availableSlots: any[] | undefined;
      if (currentState?.serviceId && currentState?.newDate) {
        const slots = await this.availabilityService.getAvailableSlots(
          businessId,
          currentState.newDate,
          currentState.serviceId,
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

      const newState = await this.rescheduleAssistant.process(messageContent, currentState, {
        businessName,
        personality,
        upcomingBookings,
        availableSlots,
        customerContext,
      });

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
        where: { businessId, role: 'ADMIN' },
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
      const provider = await this.getProviderForConversation(conversationId);
      await this.messageService.sendMessage(
        businessId,
        conversationId,
        defaultStaff.id,
        handoffMessage,
        provider,
      );

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

  async confirmBooking(businessId: string, conversationId: string): Promise<any> {
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
      source: 'AI',
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

  async confirmCancel(businessId: string, conversationId: string): Promise<any> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) throw new Error('Conversation not found');

    const metadata = (conversation.metadata as any) || {};
    const cancelState: CancelStateData | undefined = metadata.aiCancelState;
    if (!cancelState) throw new Error('No cancel state found');
    if (cancelState.state !== 'CONFIRM_CANCEL')
      throw new Error('Cancel not ready for confirmation');
    if (!cancelState.bookingId) throw new Error('No booking identified');

    const booking = await this.bookingService.updateStatus(
      businessId,
      cancelState.bookingId,
      'CANCELLED',
    );

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

  async confirmReschedule(businessId: string, conversationId: string): Promise<any> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) throw new Error('Conversation not found');

    const metadata = (conversation.metadata as any) || {};
    const rescheduleState: RescheduleStateData | undefined = metadata.aiRescheduleState;
    if (!rescheduleState) throw new Error('No reschedule state found');
    if (rescheduleState.state !== 'CONFIRM_RESCHEDULE')
      throw new Error('Reschedule not ready for confirmation');
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

  private async handleProfileCollection(
    businessId: string,
    conversationId: string,
    messageContent: string,
    business: any,
    settings: AiSettings,
    customerData: any,
    customerContext?: any,
  ): Promise<BookingStateData | null> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!conversation) return null;
      const metadata = (conversation.metadata as any) || {};
      const currentState: BookingStateData = metadata.aiBookingState;
      if (!currentState) return null;

      const requiredFields: string[] = (business.packConfig as any)?.requiredProfileFields || [];
      const previouslyCollected = currentState.collectedFields || {};

      // Check what's still missing considering previously collected fields
      const mergedCustomer = {
        name: customerData?.name || '',
        email: customerData?.email || previouslyCollected.email || null,
        customFields: { ...(customerData?.customFields || {}), ...previouslyCollected },
      };
      const { missingFields } = checkProfileCompleteness(mergedCustomer, requiredFields);

      const result = await this.profileCollector.collect(messageContent, {
        customerName: customerData?.name || 'there',
        businessName: business.name,
        personality: settings.personality,
        missingFields,
        alreadyCollected: previouslyCollected,
      });

      // Merge newly collected fields
      const allCollected = { ...previouslyCollected, ...result.collectedFields };

      if (result.allCollected || result.missingFields.length === 0) {
        // Save collected fields to customer record
        if (customerData) {
          const updateData: any = {};
          if (allCollected.email) updateData.email = allCollected.email;
          if (allCollected.firstName || allCollected.lastName) {
            const first = allCollected.firstName || customerData.name.split(' ')[0] || '';
            const last =
              allCollected.lastName || customerData.name.split(' ').slice(1).join(' ') || '';
            updateData.name = `${first} ${last}`.trim();
          }
          // Save remaining fields to customFields
          const customFieldUpdates: Record<string, any> = { ...(customerData.customFields || {}) };
          for (const [key, value] of Object.entries(allCollected)) {
            if (key !== 'email' && key !== 'firstName' && key !== 'lastName') {
              customFieldUpdates[key] = value;
            }
          }
          updateData.customFields = customFieldUpdates;
          await this.prisma.customer.update({
            where: { id: customerData.id },
            data: updateData,
          });
        }

        // Transition back to CONFIRM
        const newState: BookingStateData = {
          ...currentState,
          state: 'CONFIRM',
          missingFields: undefined,
          collectedFields: undefined,
          suggestedResponse: currentState.suggestedResponse,
        };
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { metadata: { ...metadata, aiBookingState: newState } },
        });
        return newState;
      }

      // Still collecting
      const newState: BookingStateData = {
        ...currentState,
        state: 'COLLECT_PROFILE',
        missingFields: result.missingFields,
        collectedFields: allCollected,
        suggestedResponse: result.suggestedResponse,
      };
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { metadata: { ...metadata, aiBookingState: newState } },
      });
      return newState;
    } catch (error: any) {
      this.logger.error(`Profile collection failed: ${error.message}`);
      return null;
    }
  }

  async getAiStats(businessId: string) {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Today's stats from AiUsage
    const todayUsage = await this.prisma.aiUsage.findUnique({
      where: { businessId_date: { businessId, date: today } },
    });

    // Today's drafts created
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [draftsCreated, autoReplied] = await Promise.all([
      this.prisma.outboundDraft.count({
        where: {
          businessId,
          source: { in: ['AI', 'AGENT'] },
          createdAt: { gte: todayStart, lt: todayEnd },
        },
      }),
      this.prisma.message
        .count({
          where: {
            conversation: { businessId },
            direction: 'OUTBOUND',
            createdAt: { gte: todayStart, lt: todayEnd },
            metadata: { path: ['ai', 'autoReplied'], equals: true },
          },
        })
        .catch(() => 0),
    ]);

    // Last 7 days stats
    const last7Days: Array<{ date: string; processed: number; draftsCreated: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayStart = new Date(dateStr);
      const dayEnd = new Date(dateStr);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [usage, dayDrafts] = await Promise.all([
        this.prisma.aiUsage.findUnique({
          where: { businessId_date: { businessId, date: dateStr } },
        }),
        this.prisma.outboundDraft.count({
          where: {
            businessId,
            source: { in: ['AI', 'AGENT'] },
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
      ]);

      last7Days.push({
        date: dateStr,
        processed: usage?.count || 0,
        draftsCreated: dayDrafts,
      });
    }

    return {
      today: {
        processed: todayUsage?.count || 0,
        autoReplied,
        draftsCreated,
        failed: 0, // Could query DLQ but keeping it simple
      },
      dailyLimit: MAX_AI_CALLS_PER_DAY,
      last7Days,
    };
  }

  async regenerateDraft(businessId: string, conversationId: string) {
    // Find the latest inbound message
    const lastInbound = await this.prisma.message.findFirst({
      where: { conversationId, direction: 'INBOUND' },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastInbound) {
      return { error: 'No inbound message found to regenerate draft for' };
    }

    // Re-process the message (this will create a new OutboundDraft)
    await this.processInboundMessage(
      businessId,
      conversationId,
      lastInbound.id,
      lastInbound.content,
    );

    return { ok: true, messageId: lastInbound.id };
  }

  async customerChat(
    businessId: string,
    customerId: string,
    question: string,
  ): Promise<{ answer: string }> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new Error('Business not found');

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new Error('Customer not found');

    // Load all bookings
    const bookings = await this.prisma.booking.findMany({
      where: { customerId, businessId },
      include: { service: true, staff: true },
      orderBy: { startTime: 'desc' },
    });

    // Load conversations and recent messages
    const conversations = await this.prisma.conversation.findMany({
      where: { customerId, businessId },
    });
    const conversationIds = conversations.map((c) => c.id);
    const messages =
      conversationIds.length > 0
        ? await this.prisma.message.findMany({
            where: { conversationId: { in: conversationIds } },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
        : [];

    const totalSpent = bookings
      .filter((b: any) => b.status === 'COMPLETED')
      .reduce((sum, b: any) => sum + (b.service?.price || 0), 0);

    const bookingsList = bookings
      .map((b: any) => {
        const date = b.startTime.toISOString().split('T')[0];
        const time = b.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `- ${date} ${time}: ${b.service?.name || 'Unknown'} (${b.status})${b.staff ? ` with ${b.staff.name}` : ''}`;
      })
      .join('\n');

    const messagesList = messages
      .reverse()
      .map((m) => {
        const date = m.createdAt.toISOString().split('T')[0];
        return `[${date}] ${m.direction === 'INBOUND' ? 'Customer' : 'Staff'}: ${m.content}`;
      })
      .join('\n');

    const systemPrompt = `You are an AI assistant for ${business.name}. A staff member is asking about a customer.

CUSTOMER PROFILE:
- Name: ${customer.name}
- Phone: ${customer.phone}
- Email: ${(customer as any).email || 'N/A'}
- Tags: ${((customer as any).tags || []).join(', ') || 'None'}
- Custom fields: ${JSON.stringify((customer as any).customFields || {})}
- Customer since: ${customer.createdAt.toISOString().split('T')[0]}

BOOKING HISTORY (${bookings.length} total, $${Math.round(totalSpent)} spent):
${bookingsList || 'No bookings'}

RECENT CONVERSATIONS:
${messagesList || 'No messages'}

Answer the staff's question based on this data. Be concise and helpful.
If the data doesn't contain the answer, say so honestly.`;

    const response = await this.claude.complete(
      'sonnet',
      systemPrompt,
      [{ role: 'user', content: question }],
      1024,
    );

    return { answer: response };
  }
}
