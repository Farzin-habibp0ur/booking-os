import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

export type BookingState = 'IDENTIFY_SERVICE' | 'IDENTIFY_DATE' | 'IDENTIFY_TIME' | 'CONFIRM' | 'COLLECT_PROFILE';

export interface BookingStateData {
  state: BookingState;
  serviceId?: string;
  serviceName?: string;
  date?: string;
  time?: string;
  staffId?: string;
  staffName?: string;
  slotIso?: string;
  suggestedResponse?: string;
  availableOptions?: string[];
  missingFields?: string[];
  collectedFields?: Record<string, string>;
}

@Injectable()
export class BookingAssistant {
  private readonly logger = new Logger(BookingAssistant.name);

  constructor(private claude: ClaudeClient) {}

  async process(
    messageContent: string,
    currentState: BookingStateData | null,
    context: {
      businessName: string;
      personality: string;
      services: Array<{ id: string; name: string; durationMins: number; price: number; category: string }>;
      availableSlots?: Array<{ time: string; display: string; staffId: string; staffName: string }>;
      extractedEntities?: { service?: string; date?: string; time?: string; staffName?: string };
      customerContext?: { name: string; phone: string; email?: string; tags: string[]; upcomingBookings: Array<{ serviceName: string; date: string; time: string }> };
    },
  ): Promise<BookingStateData> {
    const state = currentState?.state || 'IDENTIFY_SERVICE';

    let customerInfo = '';
    if (context.customerContext) {
      customerInfo = `\nCustomer: ${context.customerContext.name} (${context.customerContext.phone})`;
      if (context.customerContext.tags.length) customerInfo += ` | Tags: ${context.customerContext.tags.join(', ')}`;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayDay = dayNames[today.getDay()];

    const systemPrompt = `You are a booking assistant for "${context.businessName}".
Personality: ${context.personality || 'friendly and professional'}${customerInfo}
Use the customer's name naturally in your responses.
You help customers book appointments through a conversational flow.

IMPORTANT: Today is ${todayDay}, ${todayStr}. Use this to resolve relative dates like "next Tuesday", "tomorrow", etc. The year is ${today.getFullYear()}.

Current booking state: ${state}
${currentState ? `Current data: ${JSON.stringify(currentState)}` : 'No booking data yet.'}

Available services: ${JSON.stringify(context.services.map((s) => ({ id: s.id, name: s.name, duration: s.durationMins, price: s.price, category: s.category })))}
${context.availableSlots ? `Available time slots: ${JSON.stringify(context.availableSlots.slice(0, 10))}` : ''}
${context.extractedEntities ? `Entities extracted from message: ${JSON.stringify(context.extractedEntities)}` : ''}

Based on the customer's message, determine the next booking state and generate a response.

State transitions:
- IDENTIFY_SERVICE: Match customer's request to a service. If matched, move to IDENTIFY_DATE.
- IDENTIFY_DATE: Get the preferred date. If provided, move to IDENTIFY_TIME. If the customer also mentions a time (e.g., "Tuesday at 2pm"), extract both date AND time.
- IDENTIFY_TIME: Show available slots and get preferred time. If selected, move to CONFIRM.
- CONFIRM: Summarize the booking details and ask for confirmation.

IMPORTANT: If the customer provides multiple pieces of info in one message (e.g., service + date + time), skip intermediate states. For example, "Book Botox for Tuesday at 2pm" should go directly to CONFIRM if all data is available. Always extract the time as HH:MM format (e.g., "2pm" = "14:00", "10:30am" = "10:30").

Return JSON with:
- state: the next state (IDENTIFY_SERVICE, IDENTIFY_DATE, IDENTIFY_TIME, or CONFIRM)
- serviceId: matched service ID (if known)
- serviceName: matched service name (if known)
- date: preferred date in YYYY-MM-DD format (if known)
- time: preferred time display like "09:00" (if known)
- staffId: preferred staff ID (if known)
- staffName: preferred staff name (if known)
- slotIso: the exact ISO datetime of the selected slot (if known)
- suggestedResponse: a natural-language response to send to the customer
- availableOptions: array of options to present (service names, dates, or time slots)

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
        serviceId: parsed.serviceId || currentState?.serviceId,
        serviceName: parsed.serviceName || currentState?.serviceName,
        date: parsed.date || currentState?.date,
        time: parsed.time || currentState?.time,
        staffId: parsed.staffId || currentState?.staffId,
        staffName: parsed.staffName || currentState?.staffName,
        slotIso: parsed.slotIso || currentState?.slotIso,
        suggestedResponse: parsed.suggestedResponse || '',
        availableOptions: parsed.availableOptions,
      };
    } catch (error: any) {
      this.logger.error(`Booking assistant failed: ${error.message}`);
      return currentState || { state: 'IDENTIFY_SERVICE', suggestedResponse: 'I\'d be happy to help you book an appointment! What service are you interested in?' };
    }
  }
}
