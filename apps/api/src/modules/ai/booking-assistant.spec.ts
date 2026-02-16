import { Test } from '@nestjs/testing';
import { BookingAssistant, BookingStateData } from './booking-assistant';
import { ClaudeClient } from './claude.client';
import { createMockClaudeClient } from '../../test/mocks';

describe('BookingAssistant', () => {
  let assistant: BookingAssistant;
  let claude: ReturnType<typeof createMockClaudeClient>;

  const baseContext = {
    businessName: 'Glow Clinic',
    personality: 'friendly and professional',
    services: [
      { id: 'svc1', name: 'Botox', durationMins: 30, price: 200, category: 'Injectable' },
      { id: 'svc2', name: 'Facial', durationMins: 60, price: 100, category: 'Skincare' },
    ],
  };

  beforeEach(async () => {
    claude = createMockClaudeClient();

    const module = await Test.createTestingModule({
      providers: [BookingAssistant, { provide: ClaudeClient, useValue: claude }],
    }).compile();

    assistant = module.get(BookingAssistant);
  });

  it('starts at IDENTIFY_SERVICE with no current state', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'IDENTIFY_SERVICE',
        suggestedResponse: 'What service would you like?',
      }),
    );

    const result = await assistant.process('I want to book something', null, baseContext);
    expect(result.state).toBe('IDENTIFY_SERVICE');
    expect(result.suggestedResponse).toBeTruthy();
  });

  it('transitions to IDENTIFY_DATE when service matched', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'IDENTIFY_DATE',
        serviceId: 'svc1',
        serviceName: 'Botox',
        suggestedResponse: 'Great choice! When would you like?',
      }),
    );

    const result = await assistant.process('I want Botox', null, baseContext);
    expect(result.state).toBe('IDENTIFY_DATE');
    expect(result.serviceId).toBe('svc1');
    expect(result.serviceName).toBe('Botox');
  });

  it('transitions to IDENTIFY_TIME when date provided', async () => {
    const currentState: BookingStateData = {
      state: 'IDENTIFY_DATE',
      serviceId: 'svc1',
      serviceName: 'Botox',
    };

    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'IDENTIFY_TIME',
        date: '2026-03-01',
        suggestedResponse: 'Here are available times...',
        availableOptions: ['09:00', '10:00', '14:00'],
      }),
    );

    const result = await assistant.process('March 1st', currentState, baseContext);
    expect(result.state).toBe('IDENTIFY_TIME');
    expect(result.date).toBe('2026-03-01');
    expect(result.serviceId).toBe('svc1');
  });

  it('transitions to CONFIRM when time selected', async () => {
    const currentState: BookingStateData = {
      state: 'IDENTIFY_TIME',
      serviceId: 'svc1',
      serviceName: 'Botox',
      date: '2026-03-01',
    };

    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'CONFIRM',
        time: '14:00',
        slotIso: '2026-03-01T14:00:00',
        suggestedResponse: 'Shall I confirm Botox on March 1st at 2pm?',
      }),
    );

    const result = await assistant.process('2pm please', currentState, baseContext);
    expect(result.state).toBe('CONFIRM');
    expect(result.time).toBe('14:00');
    expect(result.slotIso).toBe('2026-03-01T14:00:00');
  });

  it('skips to CONFIRM when all data provided at once', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'CONFIRM',
        serviceId: 'svc1',
        serviceName: 'Botox',
        date: '2026-03-01',
        time: '14:00',
        slotIso: '2026-03-01T14:00:00',
        suggestedResponse: 'Confirm Botox March 1st at 2pm?',
      }),
    );

    const result = await assistant.process('Book Botox for March 1st at 2pm', null, baseContext);
    expect(result.state).toBe('CONFIRM');
    expect(result.serviceId).toBe('svc1');
    expect(result.date).toBe('2026-03-01');
    expect(result.time).toBe('14:00');
  });

  it('preserves previous state data on partial update', async () => {
    const currentState: BookingStateData = {
      state: 'IDENTIFY_DATE',
      serviceId: 'svc1',
      serviceName: 'Botox',
      staffId: 'staff1',
      staffName: 'Dr. Smith',
    };

    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'IDENTIFY_TIME',
        date: '2026-03-01',
        suggestedResponse: 'Pick a time',
      }),
    );

    const result = await assistant.process('March 1st', currentState, baseContext);
    expect(result.serviceId).toBe('svc1');
    expect(result.serviceName).toBe('Botox');
    expect(result.staffId).toBe('staff1');
    expect(result.staffName).toBe('Dr. Smith');
  });

  it('uses sonnet model with 1024 max tokens', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'IDENTIFY_SERVICE',
        suggestedResponse: 'What service?',
      }),
    );

    await assistant.process('Hi', null, baseContext);

    expect(claude.complete).toHaveBeenCalledWith(
      'sonnet',
      expect.any(String),
      expect.any(Array),
      1024,
    );
  });

  it('includes available slots in prompt when provided', async () => {
    const slots = [
      { time: '2026-03-01T09:00:00', display: '9:00 AM', staffId: 's1', staffName: 'Dr. Smith' },
    ];

    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'IDENTIFY_TIME',
        suggestedResponse: 'Here are available times',
      }),
    );

    await assistant.process('March 1st', null, { ...baseContext, availableSlots: slots });

    const systemPrompt = claude.complete.mock.calls[0][1];
    expect(systemPrompt).toContain('Available time slots');
  });

  it('returns fallback state on error with no current state', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await assistant.process('Hi', null, baseContext);
    expect(result.state).toBe('IDENTIFY_SERVICE');
    expect(result.suggestedResponse).toBeTruthy();
  });

  it('returns current state on error when state exists', async () => {
    const currentState: BookingStateData = {
      state: 'IDENTIFY_DATE',
      serviceId: 'svc1',
      serviceName: 'Botox',
    };

    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await assistant.process('Hi', currentState, baseContext);
    expect(result).toBe(currentState);
  });
});
