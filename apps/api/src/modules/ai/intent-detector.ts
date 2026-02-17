import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

export type IntentCategory =
  | 'BOOK_APPOINTMENT'
  | 'CANCEL'
  | 'RESCHEDULE'
  | 'INQUIRY'
  | 'CONFIRMATION'
  | 'GENERAL'
  | 'TRANSFER_TO_HUMAN'
  | 'SALES_INQUIRY'
  | 'SERVICE_APPOINTMENT'
  | 'TRADE_IN_INQUIRY';

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

function buildSystemPrompt(verticalPack?: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDay = dayNames[today.getDay()];

  const isDealership = verticalPack === 'dealership';

  const intentList = isDealership
    ? 'BOOK_APPOINTMENT, CANCEL, RESCHEDULE, INQUIRY, CONFIRMATION, TRANSFER_TO_HUMAN, SALES_INQUIRY, SERVICE_APPOINTMENT, TRADE_IN_INQUIRY, GENERAL'
    : 'BOOK_APPOINTMENT, CANCEL, RESCHEDULE, INQUIRY, CONFIRMATION, TRANSFER_TO_HUMAN, GENERAL';

  let rules = `Rules:
- BOOK_APPOINTMENT: customer wants to schedule/book an appointment or service
- CANCEL: customer wants to cancel an existing appointment
- RESCHEDULE: customer wants to change the time of an existing appointment
- INQUIRY: customer is asking about services, pricing, availability, or hours
- CONFIRMATION: customer is confirming or acknowledging something (yes, ok, sure, sounds good)
- TRANSFER_TO_HUMAN: customer wants to talk to a real person, human agent, staff member, or manager (e.g. "talk to a human", "speak to someone", "real person", "transfer me", "I want to speak with a person")`;

  if (isDealership) {
    rules += `
- SALES_INQUIRY: customer is asking about vehicle availability, pricing, features, colors, or wants a test drive ("Do you have the 2024 Tacoma?", "What colors does the X5 come in?", "I'm looking for a used SUV", "Can I test drive the new Corolla?")
- SERVICE_APPOINTMENT: customer needs vehicle maintenance, repair, or diagnostic service ("My brakes are squeaking", "Need an oil change", "Check engine light is on", "Car is making a noise")
- TRADE_IN_INQUIRY: customer wants to trade in their current vehicle or get a valuation ("I want to trade in my car", "What's my car worth?", "Trade-in value for my 2020 Civic")`;
  }

  rules += `
- GENERAL: greetings, thanks, or anything that doesn't fit above`;

  return `You are an intent classifier for a ${isDealership ? 'car dealership' : 'booking/appointment'} business. Today is ${todayDay}, ${todayStr} (year ${today.getFullYear()}).

Analyze the customer's message and return a JSON object with:
- intent: one of ${intentList}
- confidence: 0.0 to 1.0
- extractedEntities: optional object with service, date (YYYY-MM-DD format), time (HH:MM 24h format), staffName if mentioned. Resolve relative dates like "next Tuesday", "tomorrow" using today's date.

${rules}

Return ONLY valid JSON, no markdown or explanation.`;
}

@Injectable()
export class IntentDetector {
  private readonly logger = new Logger(IntentDetector.name);

  constructor(private claude: ClaudeClient) {}

  async detect(
    messageContent: string,
    recentContext?: string,
    verticalPack?: string,
  ): Promise<IntentResult> {
    const userMessage = recentContext
      ? `Recent conversation context:\n${recentContext}\n\nLatest customer message:\n${messageContent}`
      : `Customer message:\n${messageContent}`;

    try {
      const response = await this.claude.complete(
        'haiku',
        buildSystemPrompt(verticalPack),
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
