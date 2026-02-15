import { Test } from '@nestjs/testing';
import { IntentDetector } from './intent-detector';
import { ClaudeClient } from './claude.client';
import { createMockClaudeClient } from '../../test/mocks';

describe('IntentDetector', () => {
  let detector: IntentDetector;
  let claude: ReturnType<typeof createMockClaudeClient>;

  beforeEach(async () => {
    claude = createMockClaudeClient();

    const module = await Test.createTestingModule({
      providers: [
        IntentDetector,
        { provide: ClaudeClient, useValue: claude },
      ],
    }).compile();

    detector = module.get(IntentDetector);
  });

  it('parses BOOK_APPOINTMENT intent', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      intent: 'BOOK_APPOINTMENT',
      confidence: 0.95,
      extractedEntities: { service: 'Botox', date: '2026-03-01', time: '14:00' },
    }));

    const result = await detector.detect('I want to book Botox for March 1st at 2pm');
    expect(result.intent).toBe('BOOK_APPOINTMENT');
    expect(result.confidence).toBe(0.95);
    expect(result.extractedEntities?.service).toBe('Botox');
    expect(result.extractedEntities?.date).toBe('2026-03-01');
    expect(result.extractedEntities?.time).toBe('14:00');
  });

  it('parses CANCEL intent', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      intent: 'CANCEL',
      confidence: 0.9,
    }));

    const result = await detector.detect('I need to cancel my appointment');
    expect(result.intent).toBe('CANCEL');
    expect(result.confidence).toBe(0.9);
  });

  it('parses RESCHEDULE intent', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      intent: 'RESCHEDULE',
      confidence: 0.85,
    }));

    const result = await detector.detect('Can I reschedule to next week?');
    expect(result.intent).toBe('RESCHEDULE');
  });

  it('parses INQUIRY intent', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      intent: 'INQUIRY',
      confidence: 0.8,
    }));

    const result = await detector.detect('What services do you offer?');
    expect(result.intent).toBe('INQUIRY');
  });

  it('parses CONFIRMATION intent', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      intent: 'CONFIRMATION',
      confidence: 0.95,
    }));

    const result = await detector.detect('Yes, sounds good');
    expect(result.intent).toBe('CONFIRMATION');
  });

  it('parses TRANSFER_TO_HUMAN intent', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      intent: 'TRANSFER_TO_HUMAN',
      confidence: 0.9,
    }));

    const result = await detector.detect('I want to speak with a real person');
    expect(result.intent).toBe('TRANSFER_TO_HUMAN');
  });

  it('defaults to GENERAL when intent is missing in response', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      confidence: 0.5,
    }));

    const result = await detector.detect('Hello');
    expect(result.intent).toBe('GENERAL');
  });

  it('defaults confidence to 0.5 when not a number', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      intent: 'GENERAL',
      confidence: 'high',
    }));

    const result = await detector.detect('Hello');
    expect(result.confidence).toBe(0.5);
  });

  it('falls back to GENERAL with confidence 0 on error', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await detector.detect('test message');
    expect(result.intent).toBe('GENERAL');
    expect(result.confidence).toBe(0);
  });

  it('falls back on invalid JSON', async () => {
    claude.complete.mockResolvedValue('not valid json');

    const result = await detector.detect('test message');
    expect(result.intent).toBe('GENERAL');
    expect(result.confidence).toBe(0);
  });

  it('includes recent context in message when provided', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      intent: 'CONFIRMATION',
      confidence: 0.9,
    }));

    await detector.detect('Yes', 'Previous: Would you like to book?');

    const callArgs = claude.complete.mock.calls[0];
    expect(callArgs[2][0].content).toContain('Recent conversation context');
    expect(callArgs[2][0].content).toContain('Previous: Would you like to book?');
  });

  it('calls claude with haiku model and 256 max tokens', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({ intent: 'GENERAL', confidence: 0.5 }));

    await detector.detect('Hello');

    expect(claude.complete).toHaveBeenCalledWith('haiku', expect.any(String), expect.any(Array), 256);
  });
});
