import { ProfileExtractor } from './profile-extractor';
import { createMockClaudeClient } from '../../test/mocks';

describe('ProfileExtractor', () => {
  let extractor: ProfileExtractor;
  let claude: ReturnType<typeof createMockClaudeClient>;

  const sampleMessages = [
    { direction: 'INBOUND', content: 'Hi, my name is Emma Wilson', createdAt: '2026-03-01T10:00:00Z' },
    { direction: 'OUTBOUND', content: 'Welcome Emma! How can we help?', createdAt: '2026-03-01T10:01:00Z' },
    { direction: 'INBOUND', content: 'I need a Botox appointment. My email is emma@example.com', createdAt: '2026-03-01T10:02:00Z' },
  ];

  beforeEach(() => {
    claude = createMockClaudeClient();
    extractor = new ProfileExtractor(claude as any);
  });

  it('extracts full profile from transcript', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        name: 'Emma Wilson',
        email: 'emma@example.com',
        tags: ['new customer'],
        notes: 'Interested in Botox treatment.',
      }),
    );

    const result = await extractor.extract(sampleMessages);
    expect(result.name).toBe('Emma Wilson');
    expect(result.email).toBe('emma@example.com');
    expect(result.tags).toEqual(['new customer']);
    expect(result.notes).toBe('Interested in Botox treatment.');
  });

  it('passes correct transcript to Claude', async () => {
    claude.complete.mockResolvedValue('{}');

    await extractor.extract(sampleMessages);
    expect(claude.complete).toHaveBeenCalledWith(
      'haiku',
      expect.stringContaining('profile extraction engine'),
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('Customer: Hi, my name is Emma Wilson'),
        }),
      ]),
      512,
    );
  });

  it('formats INBOUND as Customer and OUTBOUND as Staff', async () => {
    claude.complete.mockResolvedValue('{}');

    await extractor.extract(sampleMessages);
    const transcript = claude.complete.mock.calls[0][2][0].content;
    expect(transcript).toContain('Customer: Hi, my name is Emma Wilson');
    expect(transcript).toContain('Staff: Welcome Emma!');
  });

  it('returns empty object on parse failure', async () => {
    claude.complete.mockResolvedValue('not valid json');

    const result = await extractor.extract(sampleMessages);
    expect(result).toEqual({});
  });

  it('returns empty object when Claude throws', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await extractor.extract(sampleMessages);
    expect(result).toEqual({});
  });

  it('omits undefined fields when Claude returns partial data', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({ name: 'Emma' }));

    const result = await extractor.extract(sampleMessages);
    expect(result.name).toBe('Emma');
    expect(result.email).toBeUndefined();
    expect(result.tags).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it('handles non-array tags gracefully', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({ tags: 'not-an-array' }));

    const result = await extractor.extract(sampleMessages);
    expect(result.tags).toBeUndefined();
  });

  it('handles empty string fields as undefined', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({ name: '', email: '' }));

    const result = await extractor.extract(sampleMessages);
    expect(result.name).toBeUndefined();
    expect(result.email).toBeUndefined();
  });
});
