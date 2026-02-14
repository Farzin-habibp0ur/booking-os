import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

export type RescheduleState = 'IDENTIFY_BOOKING' | 'IDENTIFY_NEW_DATE' | 'IDENTIFY_NEW_TIME' | 'CONFIRM_RESCHEDULE';

export interface RescheduleStateData {
  state: RescheduleState;
  bookingId?: string;
  serviceName?: string;
  serviceId?: string;
  originalDate?: string;
  originalTime?: string;
  newDate?: string;
  newTime?: string;
  newSlotIso?: string;
  staffId?: string;
  staffName?: string;
  suggestedResponse?: string;
  availableOptions?: string[];
}

@Injectable()
export class RescheduleAssistant {
  private readonly logger = new Logger(RescheduleAssistant.name);

  constructor(private claude: ClaudeClient) {}

  async process(
    messageContent: string,
    currentState: RescheduleStateData | null,
    context: {
      businessName: string;
      personality: string;
      upcomingBookings: Array<{
        id: string;
        serviceId: string;
        serviceName: string;
        date: string;
        time: string;
        staffId?: string;
        staffName?: string;
      }>;
      availableSlots?: Array<{ time: string; display: string; staffId: string; staffName: string }>;
    },
  ): Promise<RescheduleStateData> {
    const state = currentState?.state || 'IDENTIFY_BOOKING';

    // Edge case: no upcoming bookings
    if (context.upcomingBookings.length === 0) {
      return {
        state: 'IDENTIFY_BOOKING',
        suggestedResponse: `I checked and it looks like you don't have any upcoming appointments to reschedule. Would you like to book a new appointment instead?`,
      };
    }

    // Auto-select if only one booking and we haven't identified yet
    if (state === 'IDENTIFY_BOOKING' && context.upcomingBookings.length === 1 && !currentState?.bookingId) {
      const booking = context.upcomingBookings[0];
      return {
        state: 'IDENTIFY_NEW_DATE',
        bookingId: booking.id,
        serviceId: booking.serviceId,
        serviceName: booking.serviceName,
        originalDate: booking.date,
        originalTime: booking.time,
        staffId: booking.staffId,
        staffName: booking.staffName,
        suggestedResponse: `I found your upcoming appointment: ${booking.serviceName} on ${booking.date} at ${booking.time}${booking.staffName ? ` with ${booking.staffName}` : ''}. What date would you like to reschedule to?`,
      };
    }

    const systemPrompt = `You are a rescheduling assistant for "${context.businessName}".
Personality: ${context.personality || 'friendly and professional'}
You help customers reschedule their appointments through a conversational flow.

Current reschedule state: ${state}
${currentState ? `Current data: ${JSON.stringify(currentState)}` : 'No reschedule data yet.'}

Customer's upcoming bookings:
${JSON.stringify(context.upcomingBookings)}
${context.availableSlots ? `\nAvailable time slots for the new date: ${JSON.stringify(context.availableSlots.slice(0, 10))}` : ''}

Based on the customer's message, determine the next state and generate a response.

State transitions:
- IDENTIFY_BOOKING: Match customer's request to one of their bookings. If matched, move to IDENTIFY_NEW_DATE.
- IDENTIFY_NEW_DATE: Get the preferred new date. If provided, move to IDENTIFY_NEW_TIME.
- IDENTIFY_NEW_TIME: Show available slots and get preferred time. If selected, move to CONFIRM_RESCHEDULE.
- CONFIRM_RESCHEDULE: Show old vs new details, ask for confirmation.

Return JSON with:
- state: the next state
- bookingId: matched booking ID (if identified)
- serviceId: the service ID of the matched booking
- serviceName: the service name of the matched booking
- originalDate: the original date (YYYY-MM-DD)
- originalTime: the original time
- newDate: the new preferred date (YYYY-MM-DD, if known)
- newTime: the new preferred time display (if known)
- newSlotIso: the exact ISO datetime of the new selected slot (if known)
- staffId: staff ID (if applicable)
- staffName: staff name (if applicable)
- suggestedResponse: a natural-language response to send to the customer
- availableOptions: array of time slot options to present (if in IDENTIFY_NEW_TIME state)

Return ONLY valid JSON, no markdown.`;

    try {
      const response = await this.claude.complete(
        'sonnet',
        systemPrompt,
        [{ role: 'user', content: messageContent }],
        1024,
      );

      const parsed = JSON.parse(response);
      return {
        state: parsed.state || state,
        bookingId: parsed.bookingId || currentState?.bookingId,
        serviceId: parsed.serviceId || currentState?.serviceId,
        serviceName: parsed.serviceName || currentState?.serviceName,
        originalDate: parsed.originalDate || currentState?.originalDate,
        originalTime: parsed.originalTime || currentState?.originalTime,
        newDate: parsed.newDate || currentState?.newDate,
        newTime: parsed.newTime || currentState?.newTime,
        newSlotIso: parsed.newSlotIso || currentState?.newSlotIso,
        staffId: parsed.staffId || currentState?.staffId,
        staffName: parsed.staffName || currentState?.staffName,
        suggestedResponse: parsed.suggestedResponse || '',
        availableOptions: parsed.availableOptions,
      };
    } catch (error: any) {
      this.logger.error(`Reschedule assistant failed: ${error.message}`);
      return currentState || {
        state: 'IDENTIFY_BOOKING',
        suggestedResponse: 'I\'d be happy to help you reschedule your appointment. Let me look up your bookings.',
      };
    }
  }
}
