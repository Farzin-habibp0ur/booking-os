import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

export interface ExtractedProfile {
  name?: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

@Injectable()
export class ProfileExtractor {
  private readonly logger = new Logger(ProfileExtractor.name);

  constructor(private claude: ClaudeClient) {}

  async extract(
    messages: Array<{ direction: string; content: string; createdAt: string }>,
  ): Promise<ExtractedProfile> {
    const transcript = messages
      .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Staff'}: ${m.content}`)
      .join('\n');

    const systemPrompt = `You are a profile extraction engine. Analyze the conversation transcript and extract customer profile information.

Extract:
- name: The customer's name (from how they introduce themselves, sign messages, or how staff addresses them)
- email: Their email address if mentioned in any message
- tags: Relevant tags based on conversation context (e.g. "new customer", "VIP", "returning customer", "price-sensitive", "urgent"). Maximum 5 tags.
- notes: A brief 1-2 sentence summary of key interactions or preferences observed

Return a JSON object with: name, email, tags (array), notes
Only include fields where you have reasonable confidence. Omit fields if unsure.
Return ONLY valid JSON, no markdown or explanation.`;

    try {
      const response = await this.claude.complete(
        'haiku',
        systemPrompt,
        [{ role: 'user', content: `Conversation transcript:\n${transcript}` }],
        512,
      );

      const parsed = JSON.parse(response);
      return {
        name: parsed.name || undefined,
        email: parsed.email || undefined,
        tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
        notes: parsed.notes || undefined,
      };
    } catch (error: any) {
      this.logger.error(`Profile extraction failed: ${error.message}`);
      return {};
    }
  }
}
