import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export type ClaudeModel = 'haiku' | 'sonnet';

const MODEL_MAP: Record<ClaudeModel, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
};

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ClaudeClient {
  private client: Anthropic | null = null;
  private readonly logger = new Logger(ClaudeClient.name);

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — AI features disabled');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async complete(
    model: ClaudeModel,
    system: string,
    messages: ClaudeMessage[],
    maxTokens = 1024,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Claude client not initialized — ANTHROPIC_API_KEY missing');
    }

    try {
      const response = await this.client.messages.create({
        model: MODEL_MAP[model],
        max_tokens: maxTokens,
        system,
        messages,
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      let text = textBlock?.text || '';
      // Strip markdown code fences if present
      text = text
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
      return text;
    } catch (error: any) {
      this.logger.error(`Claude API error: ${error.message}`);
      throw error;
    }
  }
}
