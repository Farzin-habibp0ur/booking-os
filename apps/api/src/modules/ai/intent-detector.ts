import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

export type IntentCategory =
  | 'BOOK_APPOINTMENT'
  | 'CANCEL'
  | 'RESCHEDULE'
  | 'INQUIRY'
  | 'CONFIRMATION'
  | 'GENERAL'
  | 'TRANSFER_TO_HUMAN';

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

function buildSystemPrompt(): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDay = dayNames[today.getDay()];

  return `You are an intent classifier for a booking/appointment business. Today is ${todayDay}, ${todayStr} (year ${today.getFullYear()}).

Analyze the customer's message and return a JSON object with:
- intent: one of BOOK_APPOINTMENT, CANCEL, RESCHEDULE, INQUIRY, CONFIRMATION, TRANSFER_TO_HUMAN, GENERAL
- confidence: 0.0 to 1.0
- extractedEntities: optional object with service, date (YYYY-MM-DD format), time (HH:MM 24h format), staffName if mentioned. Resolve relative dates like "next Tuesday", "tomorrow" using today's date.

Rules:
- BOOK_APPOINTMENT: customer wants to schedule/book an appointment or service
- CANCEL: customer wants to cancel an existing appointment
- RESCHEDULE: customer wants to change the time of an existing appointment
- INQUIRY: customer is asking about services, pricing, availability, or hours
- CONFIRMATION: customer is confirming or acknowledging something (yes, ok, sure, sounds good)
- TRANSFER_TO_HUMAN: customer wants to talk to a real person, human agent, staff member, or manager (e.g. "talk to a human", "speak to someone", "real person", "transfer me", "I want to speak with a person")
- GENERAL: greetings, thanks, or anything that doesn't fit above

Return ONLY valid JSON, no markdown or explanation.`;
}

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
        buildSystemPrompt(),
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
