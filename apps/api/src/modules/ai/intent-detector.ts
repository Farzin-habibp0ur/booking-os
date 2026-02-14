import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

export type IntentCategory =
  | 'BOOK_APPOINTMENT'
  | 'CANCEL'
  | 'RESCHEDULE'
  | 'INQUIRY'
  | 'CONFIRMATION'
  | 'GENERAL';

export interface IntentResult {
  intent: IntentCategory;
  confidence: number;
  extractedEntities?: {
    service?: string;
    date?: string;
    time?: string;
    staffName?: string;
  };
}

const SYSTEM_PROMPT = `You are an intent classifier for a booking/appointment business. Analyze the customer's message and return a JSON object with:
- intent: one of BOOK_APPOINTMENT, CANCEL, RESCHEDULE, INQUIRY, CONFIRMATION, GENERAL
- confidence: 0.0 to 1.0
- extractedEntities: optional object with service, date, time, staffName if mentioned

Rules:
- BOOK_APPOINTMENT: customer wants to schedule/book an appointment or service
- CANCEL: customer wants to cancel an existing appointment
- RESCHEDULE: customer wants to change the time of an existing appointment
- INQUIRY: customer is asking about services, pricing, availability, or hours
- CONFIRMATION: customer is confirming or acknowledging something (yes, ok, sure, sounds good)
- GENERAL: greetings, thanks, or anything that doesn't fit above

Return ONLY valid JSON, no markdown or explanation.`;

@Injectable()
export class IntentDetector {
  private readonly logger = new Logger(IntentDetector.name);

  constructor(private claude: ClaudeClient) {}

  async detect(messageContent: string, recentContext?: string): Promise<IntentResult> {
    const userMessage = recentContext
      ? `Recent conversation context:\n${recentContext}\n\nLatest customer message:\n${messageContent}`
      : `Customer message:\n${messageContent}`;

    try {
      const response = await this.claude.complete(
        'haiku',
        SYSTEM_PROMPT,
        [{ role: 'user', content: userMessage }],
        256,
      );

      const parsed = JSON.parse(response);
      return {
        intent: parsed.intent || 'GENERAL',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        extractedEntities: parsed.extractedEntities,
      };
    } catch (error: any) {
      this.logger.error(`Intent detection failed: ${error.message}`);
      return { intent: 'GENERAL', confidence: 0 };
    }
  }
}
