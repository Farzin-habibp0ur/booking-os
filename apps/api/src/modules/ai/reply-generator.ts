import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';
import { IntentCategory } from './intent-detector';

export interface ReplySuggestion {
  text: string;
  type: 'quick' | 'detailed';
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
  ): Promise<ReplySuggestion[]> {
    const systemPrompt = `You are a reply suggestion engine for "${businessName}", a booking/appointment business.
Personality: ${personality || 'friendly and professional'}
The customer's intent is: ${intent}

Generate 2-3 short reply suggestions the staff can send to the customer via WhatsApp.
- Keep replies concise (1-2 sentences max)
- Match the personality described above
- If the intent is BOOK_APPOINTMENT, one suggestion should ask about preferred service/time
- If the intent is CANCEL, one suggestion should confirm the cancellation sympathetically
- If the intent is INQUIRY and services are provided, reference relevant services
${services?.length ? `\nAvailable services: ${services.join(', ')}` : ''}

Return a JSON array of objects with "text" (the reply) and "type" ("quick" for short, "detailed" for longer).
Return ONLY valid JSON, no markdown or explanation.`;

    const userMessage = recentContext
      ? `Context:\n${recentContext}\n\nLatest message: ${messageContent}`
      : `Customer message: ${messageContent}`;

    try {
      const response = await this.claude.complete(
        'haiku',
        systemPrompt,
        [{ role: 'user', content: userMessage }],
        512,
      );

      const parsed = JSON.parse(response);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(0, 3).map((s: any) => ({
        text: s.text || '',
        type: s.type === 'detailed' ? 'detailed' : 'quick',
      }));
    } catch (error: any) {
      this.logger.error(`Reply generation failed: ${error.message}`);
      return [];
    }
  }
}
