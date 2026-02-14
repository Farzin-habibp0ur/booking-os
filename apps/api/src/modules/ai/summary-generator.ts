import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from './claude.client';

@Injectable()
export class SummaryGenerator {
  private readonly logger = new Logger(SummaryGenerator.name);

  constructor(private claude: ClaudeClient) {}

  async generate(
    messages: Array<{ direction: string; content: string; createdAt: string | Date }>,
    existingSummary?: string,
  ): Promise<string> {
    const systemPrompt = `You are a conversation summarizer for a booking/appointment business.
Create a concise 2-3 sentence summary of the conversation so far.
Focus on: what the customer needs, any decisions made, and next steps.
${existingSummary ? `Previous summary: ${existingSummary}` : ''}

Return ONLY the summary text, no JSON or markdown.`;

    const transcript = messages
      .map((m) => `${m.direction === 'INBOUND' ? 'Customer' : 'Staff'}: ${m.content}`)
      .join('\n');

    try {
      return await this.claude.complete(
        'haiku',
        systemPrompt,
        [{ role: 'user', content: `Conversation transcript:\n${transcript}` }],
        256,
      );
    } catch (error: any) {
      this.logger.error(`Summary generation failed: ${error.message}`);
      return existingSummary || '';
    }
  }
}
