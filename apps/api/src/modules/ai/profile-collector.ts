import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';
import { ProfileFieldDef } from '@booking-os/shared';

export interface ProfileCollectorResult {
  collectedFields: Record<string, string>;
  missingFields: string[];
  suggestedResponse: string;
  allCollected: boolean;
}

@Injectable()
export class ProfileCollector {
  private readonly logger = new Logger(ProfileCollector.name);

  constructor(private claude: ClaudeClient) {}

  async collect(
    messageContent: string,
    context: {
      customerName: string;
      businessName: string;
      personality: string;
      missingFields: ProfileFieldDef[];
      alreadyCollected: Record<string, string>;
    },
  ): Promise<ProfileCollectorResult> {
    const missingList = context.missingFields
      .map((f) => `- ${f.key}: ${f.label} (${f.type})`)
      .join('\n');

    const collectedList = Object.entries(context.alreadyCollected)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    const systemPrompt = `You are a friendly booking assistant for "${context.businessName}".
Personality: ${context.personality || 'friendly and professional'}

You are collecting profile information from customer "${context.customerName}" before confirming their booking.

MISSING FIELDS (still need to collect):
${missingList || 'None'}

ALREADY COLLECTED:
${collectedList || 'None yet'}

Your task:
1. Extract any field values from the customer's message
2. If fields remain, ask for them naturally and briefly
3. Be conversational — don't list all fields at once, ask for 1-2 at a time
4. When asking for info, be brief: "Could you share your email address?" not a long paragraph

Return JSON with:
- collectedFields: object of key-value pairs extracted from this message (only newly extracted)
- missingFields: array of field keys still missing after extraction
- suggestedResponse: natural response to send to the customer
- allCollected: true if no more fields are missing

Return ONLY valid JSON, no markdown.`;

    try {
      const response = await this.claude.complete(
        'haiku',
        systemPrompt,
        [{ role: 'user', content: messageContent }],
        512,
      );

      const parsed = JSON.parse(response);
      return {
        collectedFields: parsed.collectedFields || {},
        missingFields: parsed.missingFields || [],
        suggestedResponse: parsed.suggestedResponse || '',
        allCollected: !!parsed.allCollected,
      };
    } catch (error: any) {
      this.logger.error(`Profile collector failed: ${error.message}`);
      return {
        collectedFields: {},
        missingFields: context.missingFields.map((f) => f.key),
        suggestedResponse:
          "I'd like to collect a bit more info before confirming. Could you share your details?",
        allCollected: false,
      };
    }
  }
}
