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
    channel?: string,
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

    const channelGuidance = this.getChannelGuidance(channel);

    const systemPrompt = `You are a reply drafting engine for "${businessName}", a booking/appointment business.
Personality: ${personality || 'friendly and professional'}
The customer's intent is: ${intent}
${customerInfo}
${channelGuidance}

Generate ONE complete, well-crafted draft response that the staff can review, edit, and send to the customer.
- Write a full, natural response
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
      let draftText = parsed.draftText || '';

      // SMS post-generation check: re-prompt if over 160 chars
      if (channel?.toUpperCase() === 'SMS' && draftText.length > 160) {
        this.logger.debug(
          `SMS draft is ${draftText.length} chars, re-prompting for shorter version`,
        );
        try {
          const shortenResponse = await this.claude.complete(
            'haiku',
            `The following response is ${draftText.length} characters but SMS has a 160-character limit. Please shorten it to under 155 characters while preserving the key information.\n\nReturn a JSON object with "draftText" (the shortened response). Return ONLY valid JSON.`,
            [{ role: 'user', content: `Response to shorten: ${draftText}` }],
            256,
          );
          const shortenParsed = JSON.parse(shortenResponse);
          if (shortenParsed.draftText && shortenParsed.draftText.length <= 160) {
            draftText = shortenParsed.draftText;
          }
        } catch (shortenErr: any) {
          this.logger.warn(`SMS shortening failed, using original: ${shortenErr.message}`);
        }
      }

      return { draftText };
    } catch (error: any) {
      this.logger.error(`Reply generation failed: ${error.message}`);
      return { draftText: '' };
    }
  }

  private getChannelGuidance(channel?: string): string {
    if (!channel) return '';
    const ch = channel.toUpperCase();
    const rules: Record<string, string> = {
      SMS: `You are generating a reply that will be sent via SMS.
Channel rules: Keep response under 160 characters (1 segment). Be extremely concise. No markdown, emojis, or formatting. Plain text only.`,
      INSTAGRAM: `You are generating a reply that will be sent via Instagram DM.
Channel rules: Keep under 1000 characters. Use a casual, friendly tone. No HTML. Emojis are okay but use sparingly.`,
      FACEBOOK: `You are generating a reply that will be sent via Facebook Messenger.
Channel rules: Conversational tone. Keep under 2000 characters. Emojis are okay.`,
      WHATSAPP: `You are generating a reply that will be sent via WhatsApp.
Channel rules: Conversational tone. Can use *bold* and _italic_. Keep under 4096 characters.`,
      EMAIL: `You are generating a reply that will be sent via Email.
Channel rules: Professional tone. Include a greeting and sign-off. Can be longer and more detailed. Use proper paragraphs.`,
      WEB_CHAT: `You are generating a reply that will be sent via live web chat.
Channel rules: Concise and helpful. Customer is actively waiting. Keep under 500 characters.`,
    };
    return rules[ch] || '';
  }
}
