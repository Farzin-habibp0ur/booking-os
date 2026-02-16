import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

export type CancelState = 'IDENTIFY_BOOKING' | 'CONFIRM_CANCEL';

export interface CancelStateData {
  state: CancelState;
  bookingId?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  staffName?: string;
  suggestedResponse?: string;
}

@Injectable()
export class CancelAssistant {
  private readonly logger = new Logger(CancelAssistant.name);

  constructor(private claude: ClaudeClient) {}

  async process(
    messageContent: string,
    currentState: CancelStateData | null,
    context: {
      businessName: string;
      personality: string;
      upcomingBookings: Array<{
        id: string;
        serviceName: string;
        date: string;
        time: string;
        staffName?: string;
      }>;
      customerContext?: { name: string; phone: string; email?: string; tags: string[] };
    },
  ): Promise<CancelStateData> {
    const state = currentState?.state || 'IDENTIFY_BOOKING';

    // Edge case: no upcoming bookings
    if (context.upcomingBookings.length === 0) {
      return {
        state: 'IDENTIFY_BOOKING',
        suggestedResponse: `I checked and it looks like you don't have any upcoming appointments with us. Would you like to book a new appointment instead?`,
      };
    }

    // Auto-select if only one booking
    if (
      state === 'IDENTIFY_BOOKING' &&
      context.upcomingBookings.length === 1 &&
      !currentState?.bookingId
    ) {
      const booking = context.upcomingBookings[0];
      return {
        state: 'CONFIRM_CANCEL',
        bookingId: booking.id,
        serviceName: booking.serviceName,
        date: booking.date,
        time: booking.time,
        staffName: booking.staffName,
        suggestedResponse: `I found your upcoming appointment: ${booking.serviceName} on ${booking.date} at ${booking.time}${booking.staffName ? ` with ${booking.staffName}` : ''}. Would you like me to cancel this appointment for you?`,
      };
    }

    let customerInfo = '';
    if (context.customerContext) {
      customerInfo = `\nCustomer: ${context.customerContext.name} (${context.customerContext.phone})`;
    }

    const systemPrompt = `You are a cancellation assistant for "${context.businessName}".
Personality: ${context.personality || 'friendly and professional'}${customerInfo}
Use the customer's name naturally in your responses.
You help customers cancel their appointments through a conversational flow.

Current cancellation state: ${state}
${currentState ? `Current data: ${JSON.stringify(currentState)}` : 'No cancellation data yet.'}

Customer's upcoming bookings:
${JSON.stringify(context.upcomingBookings)}

Based on the customer's message, determine the next state and generate a response.

State transitions:
- IDENTIFY_BOOKING: Match customer's request to one of their bookings. If matched (or only one booking), move to CONFIRM_CANCEL.
- CONFIRM_CANCEL: Present booking details, ask for confirmation.

Return JSON with:
- state: the next state (IDENTIFY_BOOKING or CONFIRM_CANCEL)
- bookingId: matched booking ID (if identified)
- serviceName: the service name of the matched booking
- date: the date of the matched booking (YYYY-MM-DD)
- time: the time of the matched booking
- staffName: the staff name (if applicable)
- suggestedResponse: a natural-language response to send to the customer

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
        serviceName: parsed.serviceName || currentState?.serviceName,
        date: parsed.date || currentState?.date,
        time: parsed.time || currentState?.time,
        staffName: parsed.staffName || currentState?.staffName,
        suggestedResponse: parsed.suggestedResponse || '',
      };
    } catch (error: any) {
      this.logger.error(`Cancel assistant failed: ${error.message}`);
      return (
        currentState || {
          state: 'IDENTIFY_BOOKING',
          suggestedResponse:
            "I'd be happy to help you cancel your appointment. Let me look up your bookings.",
        }
      );
    }
  }
}
