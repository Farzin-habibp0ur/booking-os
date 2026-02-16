import { Test } from '@nestjs/testing';
import { ProfileCollector } from './profile-collector';
import { ClaudeClient } from './claude.client';
import { createMockClaudeClient } from '../../test/mocks';
import { ProfileFieldDef } from '@booking-os/shared';

describe('ProfileCollector', () => {
  let collector: ProfileCollector;
  let claude: ReturnType<typeof createMockClaudeClient>;

  const missingFields: ProfileFieldDef[] = [
    { key: 'email', label: 'Email Address', type: 'email', category: 'basic' },
    { key: 'allergies', label: 'Allergies', type: 'text', category: 'medical' },
  ];

  const baseContext = {
    customerName: 'Jane',
    businessName: 'Glow Clinic',
    personality: 'friendly',
    missingFields,
    alreadyCollected: {},
  };

  beforeEach(async () => {
    claude = createMockClaudeClient();

    const module = await Test.createTestingModule({
      providers: [ProfileCollector, { provide: ClaudeClient, useValue: claude }],
    }).compile();

    collector = module.get(ProfileCollector);
  });

  it('extracts fields from customer message', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        collectedFields: { email: 'jane@test.com' },
        missingFields: ['allergies'],
        suggestedResponse: 'Thanks! Do you have any allergies?',
        allCollected: false,
      }),
    );

    const result = await collector.collect('My email is jane@test.com', baseContext);
    expect(result.collectedFields).toEqual({ email: 'jane@test.com' });
    expect(result.missingFields).toEqual(['allergies']);
    expect(result.allCollected).toBe(false);
  });

  it('marks allCollected when all fields provided', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        collectedFields: { email: 'jane@test.com', allergies: 'None' },
        missingFields: [],
        suggestedResponse: 'Perfect, confirming your booking!',
        allCollected: true,
      }),
    );

    const result = await collector.collect('Email is jane@test.com and no allergies', baseContext);
    expect(result.allCollected).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it('handles partial answers across messages', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        collectedFields: { allergies: 'Penicillin' },
        missingFields: [],
        suggestedResponse: 'All set!',
        allCollected: true,
      }),
    );

    const contextWithPrior = {
      ...baseContext,
      missingFields: [missingFields[1]],
      alreadyCollected: { email: 'jane@test.com' },
    };

    const result = await collector.collect("I'm allergic to Penicillin", contextWithPrior);
    expect(result.collectedFields).toEqual({ allergies: 'Penicillin' });
    expect(result.allCollected).toBe(true);
  });

  it('defaults collectedFields to empty object on missing response field', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        missingFields: ['email', 'allergies'],
        suggestedResponse: 'Could you share your info?',
        allCollected: false,
      }),
    );

    const result = await collector.collect('Hello', baseContext);
    expect(result.collectedFields).toEqual({});
  });

  it('returns fallback on error', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await collector.collect('Hello', baseContext);
    expect(result.allCollected).toBe(false);
    expect(result.missingFields).toEqual(['email', 'allergies']);
    expect(result.suggestedResponse).toBeTruthy();
    expect(result.collectedFields).toEqual({});
  });

  it('uses haiku model with 512 max tokens', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        collectedFields: {},
        missingFields: ['email'],
        suggestedResponse: 'What is your email?',
        allCollected: false,
      }),
    );

    await collector.collect('Hi', baseContext);

    expect(claude.complete).toHaveBeenCalledWith(
      'haiku',
      expect.any(String),
      expect.any(Array),
      512,
    );
  });

  it('includes already collected fields in prompt', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        collectedFields: {},
        missingFields: ['allergies'],
        suggestedResponse: 'Any allergies?',
        allCollected: false,
      }),
    );

    await collector.collect('Hi', {
      ...baseContext,
      alreadyCollected: { email: 'jane@test.com' },
    });

    const systemPrompt = claude.complete.mock.calls[0][1];
    expect(systemPrompt).toContain('email: jane@test.com');
  });
});
