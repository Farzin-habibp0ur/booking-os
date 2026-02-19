import { Injectable, Logger } from '@nestjs/common';
import { ActionCardService } from '../action-card/action-card.service';

export interface ConversationActionContext {
  businessId: string;
  conversationId: string;
  customerId?: string;
  customerName?: string;
  intent: string;
  confidence: number;
}

export interface BookingActionData {
  state: string;
  serviceId?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  slotIso?: string;
  staffId?: string;
  staffName?: string;
}

export interface CancelActionData {
  state: string;
  bookingId?: string;
  serviceName?: string;
}

export interface RescheduleActionData {
  state: string;
  bookingId?: string;
  newDate?: string;
  newTime?: string;
  newSlotIso?: string;
}

@Injectable()
export class ConversationActionHandler {
  private readonly logger = new Logger(ConversationActionHandler.name);

  constructor(private actionCardService: ActionCardService) {}

  async handleBookingState(ctx: ConversationActionContext, booking: BookingActionData) {
    if (booking.state !== 'CONFIRM' || !booking.serviceId || !booking.slotIso) {
      return null;
    }

    try {
      return await this.actionCardService.create({
        businessId: ctx.businessId,
        type: 'BOOKING_CONFIRM',
        category: 'NEEDS_APPROVAL',
        priority: 80,
        title: `Confirm booking for ${ctx.customerName || 'customer'}`,
        description: `Because ${ctx.customerName || 'a customer'} wants to book ${booking.serviceName || 'a service'} on ${booking.date || 'selected date'} at ${booking.time || 'selected time'}${booking.staffName ? ` with ${booking.staffName}` : ''}.`,
        suggestedAction: 'Approve to confirm the booking',
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        staffId: booking.staffId,
        metadata: {
          intent: ctx.intent,
          confidence: ctx.confidence,
          bookingData: booking,
          source: 'conversation',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create booking action card for conversation ${ctx.conversationId}: ${err.message}`,
      );
      return null;
    }
  }

  async handleCancelState(ctx: ConversationActionContext, cancel: CancelActionData) {
    if (cancel.state !== 'CONFIRM_CANCEL' || !cancel.bookingId) {
      return null;
    }

    try {
      return await this.actionCardService.create({
        businessId: ctx.businessId,
        type: 'BOOKING_CANCEL',
        category: 'NEEDS_APPROVAL',
        priority: 75,
        title: `Approve cancellation for ${ctx.customerName || 'customer'}`,
        description: `Because ${ctx.customerName || 'a customer'} requested to cancel their ${cancel.serviceName || ''} appointment.`,
        suggestedAction: 'Approve to cancel the booking',
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        bookingId: cancel.bookingId,
        metadata: {
          intent: ctx.intent,
          confidence: ctx.confidence,
          cancelData: cancel,
          source: 'conversation',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create cancel action card for conversation ${ctx.conversationId}: ${err.message}`,
      );
      return null;
    }
  }

  async handleRescheduleState(ctx: ConversationActionContext, reschedule: RescheduleActionData) {
    if (reschedule.state !== 'CONFIRM_RESCHEDULE' || !reschedule.bookingId || !reschedule.newSlotIso) {
      return null;
    }

    try {
      return await this.actionCardService.create({
        businessId: ctx.businessId,
        type: 'BOOKING_RESCHEDULE',
        category: 'NEEDS_APPROVAL',
        priority: 70,
        title: `Approve reschedule for ${ctx.customerName || 'customer'}`,
        description: `Because ${ctx.customerName || 'a customer'} wants to reschedule to ${reschedule.newDate || 'new date'} at ${reschedule.newTime || 'new time'}.`,
        suggestedAction: 'Approve to reschedule the booking',
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        bookingId: reschedule.bookingId,
        metadata: {
          intent: ctx.intent,
          confidence: ctx.confidence,
          rescheduleData: reschedule,
          source: 'conversation',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create reschedule action card for conversation ${ctx.conversationId}: ${err.message}`,
      );
      return null;
    }
  }

  async handleLowConfidence(ctx: ConversationActionContext) {
    if (ctx.confidence >= 0.6) return null;

    try {
      return await this.actionCardService.create({
        businessId: ctx.businessId,
        type: 'LOW_CONFIDENCE',
        category: 'NEEDS_APPROVAL',
        priority: 60,
        title: `Review AI response for ${ctx.customerName || 'customer'}`,
        description: `Because the AI confidence for intent "${ctx.intent}" is ${Math.round(ctx.confidence * 100)}%, which is below the threshold. Human review recommended.`,
        suggestedAction: 'Review the conversation and respond manually',
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
        metadata: {
          intent: ctx.intent,
          confidence: ctx.confidence,
          source: 'conversation',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create low-confidence card for conversation ${ctx.conversationId}: ${err.message}`,
      );
      return null;
    }
  }

  async handleTransferToHuman(ctx: ConversationActionContext) {
    try {
      return await this.actionCardService.create({
        businessId: ctx.businessId,
        type: 'HUMAN_TAKEOVER',
        category: 'URGENT_TODAY',
        priority: 90,
        title: `Human takeover requested by ${ctx.customerName || 'customer'}`,
        description: `Because the customer explicitly requested to speak with a human or the conversation requires manual handling.`,
        suggestedAction: 'Take over the conversation and respond',
        conversationId: ctx.conversationId,
        customerId: ctx.customerId,
        metadata: {
          intent: ctx.intent,
          confidence: ctx.confidence,
          source: 'conversation',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create human takeover card for conversation ${ctx.conversationId}: ${err.message}`,
      );
      return null;
    }
  }
}
