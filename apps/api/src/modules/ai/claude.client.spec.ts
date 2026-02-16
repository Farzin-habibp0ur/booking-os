import { ConfigService } from '@nestjs/config';
import { ClaudeClient } from './claude.client';

// Mock the entire Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  };
});

import Anthropic from '@anthropic-ai/sdk';

describe('ClaudeClient', () => {
  let configService: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('returns true when API key is set', () => {
      configService = { get: jest.fn().mockReturnValue('test-api-key') };
      const client = new ClaudeClient(configService as unknown as ConfigService);
      expect(client.isAvailable()).toBe(true);
    });

    it('returns false when API key is not set', () => {
      configService = { get: jest.fn().mockReturnValue(undefined) };
      const client = new ClaudeClient(configService as unknown as ConfigService);
      expect(client.isAvailable()).toBe(false);
    });

    it('returns false when API key is empty string', () => {
      configService = { get: jest.fn().mockReturnValue('') };
      const client = new ClaudeClient(configService as unknown as ConfigService);
      expect(client.isAvailable()).toBe(false);
    });
  });

  describe('complete', () => {
    it('throws when client not initialized', async () => {
      configService = { get: jest.fn().mockReturnValue(undefined) };
      const client = new ClaudeClient(configService as unknown as ConfigService);

      await expect(
        client.complete('haiku', 'system', [{ role: 'user', content: 'hi' }]),
      ).rejects.toThrow('Claude client not initialized');
    });

    it('strips markdown code fences from response', async () => {
      configService = { get: jest.fn().mockReturnValue('test-key') };
      const client = new ClaudeClient(configService as unknown as ConfigService);

      const mockCreate = (Anthropic as unknown as jest.Mock).mock.results[0].value.messages.create;
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '```json\n{"intent":"GENERAL"}\n```' }],
      });

      const result = await client.complete('haiku', 'system', [{ role: 'user', content: 'hi' }]);
      expect(result).toBe('{"intent":"GENERAL"}');
    });

    it('returns plain text when no code fences', async () => {
      configService = { get: jest.fn().mockReturnValue('test-key') };
      const client = new ClaudeClient(configService as unknown as ConfigService);

      const mockCreate = (Anthropic as unknown as jest.Mock).mock.results[0].value.messages.create;
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '{"intent":"GENERAL"}' }],
      });

      const result = await client.complete('haiku', 'system', [{ role: 'user', content: 'hi' }]);
      expect(result).toBe('{"intent":"GENERAL"}');
    });

    it('returns empty string when no text block found', async () => {
      configService = { get: jest.fn().mockReturnValue('test-key') };
      const client = new ClaudeClient(configService as unknown as ConfigService);

      const mockCreate = (Anthropic as unknown as jest.Mock).mock.results[0].value.messages.create;
      mockCreate.mockResolvedValue({
        content: [],
      });

      const result = await client.complete('haiku', 'system', [{ role: 'user', content: 'hi' }]);
      expect(result).toBe('');
    });

    it('propagates API errors', async () => {
      configService = { get: jest.fn().mockReturnValue('test-key') };
      const client = new ClaudeClient(configService as unknown as ConfigService);

      const mockCreate = (Anthropic as unknown as jest.Mock).mock.results[0].value.messages.create;
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        client.complete('haiku', 'system', [{ role: 'user', content: 'hi' }]),
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('uses correct model mapping for haiku', async () => {
      configService = { get: jest.fn().mockReturnValue('test-key') };
      const client = new ClaudeClient(configService as unknown as ConfigService);

      const mockCreate = (Anthropic as unknown as jest.Mock).mock.results[0].value.messages.create;
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await client.complete('haiku', 'system prompt', [{ role: 'user', content: 'hi' }], 256);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: 'system prompt',
        messages: [{ role: 'user', content: 'hi' }],
      });
    });

    it('uses correct model mapping for sonnet', async () => {
      configService = { get: jest.fn().mockReturnValue('test-key') };
      const client = new ClaudeClient(configService as unknown as ConfigService);

      const mockCreate = (Anthropic as unknown as jest.Mock).mock.results[0].value.messages.create;
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await client.complete('sonnet', 'system', [{ role: 'user', content: 'hi' }]);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-5-20250929' }),
      );
    });

    it('defaults maxTokens to 1024', async () => {
      configService = { get: jest.fn().mockReturnValue('test-key') };
      const client = new ClaudeClient(configService as unknown as ConfigService);

      const mockCreate = (Anthropic as unknown as jest.Mock).mock.results[0].value.messages.create;
      mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

      await client.complete('haiku', 'system', [{ role: 'user', content: 'hi' }]);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 1024 }));
    });
  });
});
