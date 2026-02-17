import { SummaryGenerator } from './summary-generator';
import { createMockClaudeClient } from '../../test/mocks';

describe('SummaryGenerator', () => {
  let generator: SummaryGenerator;
  let claude: ReturnType<typeof createMockClaudeClient>;

  const sampleMessages = [
    { direction: 'INBOUND', content: 'I want to book a facial', createdAt: '2026-03-01T10:00:00Z' },
    {
      direction: 'OUTBOUND',
      content: 'Sure! We have availability tomorrow at 2pm',
      createdAt: '2026-03-01T10:01:00Z',
    },
    {
      direction: 'INBOUND',
      content: 'Perfect, please book that',
      createdAt: '2026-03-01T10:02:00Z',
    },
  ];

  beforeEach(() => {
    claude = createMockClaudeClient();
    generator = new SummaryGenerator(claude as any);
  });

  it('generates summary from transcript', async () => {
    claude.complete.mockResolvedValue('Customer requested a facial. Booked for tomorrow at 2pm.');

    const result = await generator.generate(sampleMessages);
    expect(result).toBe('Customer requested a facial. Booked for tomorrow at 2pm.');
  });

  it('passes existing summary to Claude when provided', async () => {
    claude.complete.mockResolvedValue('Updated summary.');

    await generator.generate(sampleMessages, 'Previous summary here');
    expect(claude.complete).toHaveBeenCalledWith(
      'haiku',
      expect.stringContaining('Previous summary: Previous summary here'),
      expect.anything(),
      256,
    );
  });

  it('does not include previous summary text when none exists', async () => {
    claude.complete.mockResolvedValue('New summary.');

    await generator.generate(sampleMessages);
    const systemPrompt = claude.complete.mock.calls[0][1];
    expect(systemPrompt).not.toContain('Previous summary:');
  });

  it('returns existing summary on error', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await generator.generate(sampleMessages, 'Existing summary');
    expect(result).toBe('Existing summary');
  });

  it('returns empty string on error when no existing summary', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await generator.generate(sampleMessages);
    expect(result).toBe('');
  });

  it('formats transcript correctly with directions', async () => {
    claude.complete.mockResolvedValue('Summary');

    await generator.generate(sampleMessages);
    const transcript = claude.complete.mock.calls[0][2][0].content;
    expect(transcript).toContain('Customer: I want to book a facial');
    expect(transcript).toContain('Staff: Sure! We have availability tomorrow at 2pm');
  });
});
