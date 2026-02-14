import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';
import { IntentCategory } from './intent-detector';

export interface DraftReply {
  draftText: string;
}

@Injectable()
export class ReplyGenerator {
  private readonly logger = new Logger(ReplyGenerator.name);

  constructor(private claude: ClaudeClient) {}

  async generate(
    messageContent: string,
    intent: IntentCategory,
    businessName: string,
    personality: string,
    recentContext?: string,
    services?: string[],
    customerContext?: {
      name: string;
      phone: string;
      email?: string;
      tags: string[];
      upcomingBookings: Array<{ serviceName: string; date: string; time: string }>;
    },
  ): Promise<DraftReply> {
    let customerInfo = '';
    if (customerContext) {
      customerInfo = `\nCustomer info: Name: ${customerContext.name}, Phone: ${customerContext.phone}`;
      if (customerContext.email) customerInfo += `, Email: ${customerContext.email}`;
      if (customerContext.tags.length) customerInfo += `, Tags: ${customerContext.tags.join(', ')}`;
      if (customerContext.upcomingBookings.length) {
        customerInfo += `\nUpcoming bookings: ${customerContext.upcomingBookings.map((b) => `${b.serviceName} on ${b.date} at ${b.time}`).join('; ')}`;
      }
    }

    const systemPrompt = `You are a reply drafting engine for "${businessName}", a booking/appointment business.
Personality: ${personality || 'friendly and professional'}
The customer's intent is: ${intent}
${customerInfo}

Generate ONE complete, well-crafted draft response that the staff can review, edit, and send to the customer via WhatsApp.
- Write a full, natural response (2-4 sentences)
- Match the personality described above
- Use the customer's name naturally when available (e.g. "Hi Sarah, ...")
- Reference their booking details when relevant
- If the intent is BOOK_APPOINTMENT, ask about preferred service/time and guide them
- If the intent is CANCEL, acknowledge sympathetically and offer to help with cancellation
- If the intent is RESCHEDULE, acknowledge and offer to help find a new time
- If the intent is INQUIRY and services are provided, reference relevant services
- If the intent is GENERAL, respond warmly and offer assistance
${services?.length ? `\nAvailable services: ${services.join(', ')}` : ''}

Return a JSON object with "draftText" (the complete draft response).
Return ONLY valid JSON, no markdown or explanation.`;

    const userMessage = recentContext
      ? `Context:\n${recentContext}\n\nLatest message: ${messageContent}`
      : `Customer message: ${messageContent}`;

    try {
      const response = await this.claude.complete(
        'haiku',
        systemPrompt,
        [{ role: 'user', content: userMessage }],
        1024,
      );

      const parsed = JSON.parse(response);
      return { draftText: parsed.draftText || '' };
    } catch (error: any) {
      this.logger.error(`Reply generation failed: ${error.message}`);
      return { draftText: '' };
    }
  }
}
