import { Test } from '@nestjs/testing';
import { ReplyGenerator } from './reply-generator';
import { ClaudeClient } from './claude.client';
import { createMockClaudeClient } from '../../test/mocks';

describe('ReplyGenerator', () => {
  let generator: ReplyGenerator;
  let claude: ReturnType<typeof createMockClaudeClient>;

  beforeEach(async () => {
    claude = createMockClaudeClient();

    const module = await Test.createTestingModule({
      providers: [ReplyGenerator, { provide: ClaudeClient, useValue: claude }],
    }).compile();

    generator = module.get(ReplyGenerator);
  });

  it('generates draft reply for GENERAL intent', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        draftText: 'Hi! How can I help you today?',
      }),
    );

    const result = await generator.generate('Hello', 'GENERAL', 'Glow Clinic', 'friendly');
    expect(result.draftText).toBe('Hi! How can I help you today?');
  });

  it('generates draft for BOOK_APPOINTMENT intent', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        draftText: "I'd love to help you book! What service are you interested in?",
      }),
    );

    const result = await generator.generate(
      'I want to book something',
      'BOOK_APPOINTMENT',
      'Glow Clinic',
      'friendly',
    );
    expect(result.draftText).toBeTruthy();
  });

  it('includes services in prompt when provided', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        draftText: 'We offer Botox and Facial treatments.',
      }),
    );

    await generator.generate(
      'What services do you have?',
      'INQUIRY',
      'Glow Clinic',
      'friendly',
      undefined,
      ['Botox', 'Facial'],
    );

    const systemPrompt = claude.complete.mock.calls[0][1];
    expect(systemPrompt).toContain('Botox');
    expect(systemPrompt).toContain('Facial');
  });

  it('handles empty services list', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        draftText: 'Let me find out about our services.',
      }),
    );

    await generator.generate('What services?', 'INQUIRY', 'Glow Clinic', 'friendly', undefined, []);

    // Should not throw
    expect(claude.complete).toHaveBeenCalled();
  });

  it('includes recent context when provided', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({ draftText: 'Sure!' }));

    await generator.generate(
      'Yes',
      'CONFIRMATION',
      'Glow Clinic',
      'friendly',
      'Staff: Would you like to proceed?',
    );

    const userMessage = claude.complete.mock.calls[0][2][0].content;
    expect(userMessage).toContain('Context:');
    expect(userMessage).toContain('Would you like to proceed?');
  });

  it('includes customer context in prompt', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({ draftText: 'Hi Sarah!' }));

    await generator.generate('Hello', 'GENERAL', 'Glow Clinic', 'friendly', undefined, undefined, {
      name: 'Sarah',
      phone: '+1234567890',
      email: 'sarah@test.com',
      tags: ['VIP'],
      upcomingBookings: [{ serviceName: 'Botox', date: '2026-03-01', time: '14:00' }],
    });

    const systemPrompt = claude.complete.mock.calls[0][1];
    expect(systemPrompt).toContain('Sarah');
    expect(systemPrompt).toContain('VIP');
    expect(systemPrompt).toContain('Botox');
  });

  it('returns empty draftText on error', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await generator.generate('Hello', 'GENERAL', 'Glow Clinic', 'friendly');
    expect(result.draftText).toBe('');
  });

  it('returns empty draftText when response missing field', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({}));

    const result = await generator.generate('Hello', 'GENERAL', 'Glow Clinic', 'friendly');
    expect(result.draftText).toBe('');
  });

  it('uses haiku model with 1024 max tokens', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({ draftText: 'Hi!' }));

    await generator.generate('Hello', 'GENERAL', 'Glow Clinic', 'friendly');

    expect(claude.complete).toHaveBeenCalledWith(
      'haiku',
      expect.any(String),
      expect.any(Array),
      1024,
    );
  });
});
