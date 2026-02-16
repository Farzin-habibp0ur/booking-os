import { Test } from '@nestjs/testing';
import { CancelAssistant } from './cancel-assistant';
import { ClaudeClient } from './claude.client';
import { createMockClaudeClient } from '../../test/mocks';

describe('CancelAssistant', () => {
  let assistant: CancelAssistant;
  let claude: ReturnType<typeof createMockClaudeClient>;

  const baseContext = {
    businessName: 'Glow Clinic',
    personality: 'friendly and professional',
    upcomingBookings: [
      { id: 'b1', serviceName: 'Botox', date: '2026-03-01', time: '14:00', staffName: 'Dr. Smith' },
      { id: 'b2', serviceName: 'Facial', date: '2026-03-05', time: '10:00' },
    ],
  };

  beforeEach(async () => {
    claude = createMockClaudeClient();

    const module = await Test.createTestingModule({
      providers: [CancelAssistant, { provide: ClaudeClient, useValue: claude }],
    }).compile();

    assistant = module.get(CancelAssistant);
  });

  it('auto-selects single booking and moves to CONFIRM_CANCEL', async () => {
    const context = {
      ...baseContext,
      upcomingBookings: [baseContext.upcomingBookings[0]],
    };

    const result = await assistant.process('I want to cancel', null, context);
    expect(result.state).toBe('CONFIRM_CANCEL');
    expect(result.bookingId).toBe('b1');
    expect(result.serviceName).toBe('Botox');
    expect(result.suggestedResponse).toContain('Botox');
  });

  it('returns helpful message when no upcoming bookings', async () => {
    const result = await assistant.process('Cancel my appointment', null, {
      ...baseContext,
      upcomingBookings: [],
    });

    expect(result.state).toBe('IDENTIFY_BOOKING');
    expect(result.suggestedResponse).toContain("don't have any upcoming");
  });

  it('asks which booking to cancel when multiple exist', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'IDENTIFY_BOOKING',
        suggestedResponse: 'Which appointment would you like to cancel?',
      }),
    );

    const result = await assistant.process('Cancel my appointment', null, baseContext);
    expect(result.state).toBe('IDENTIFY_BOOKING');
    expect(claude.complete).toHaveBeenCalled();
  });

  it('identifies specific booking from multiple', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'CONFIRM_CANCEL',
        bookingId: 'b1',
        serviceName: 'Botox',
        date: '2026-03-01',
        time: '14:00',
        suggestedResponse: 'Cancel Botox on March 1st?',
      }),
    );

    const result = await assistant.process('Cancel the Botox one', null, baseContext);
    expect(result.state).toBe('CONFIRM_CANCEL');
    expect(result.bookingId).toBe('b1');
  });

  it('preserves state data on partial response', async () => {
    claude.complete.mockResolvedValue(
      JSON.stringify({
        state: 'CONFIRM_CANCEL',
        suggestedResponse: 'Confirm cancel?',
      }),
    );

    const currentState = {
      state: 'IDENTIFY_BOOKING' as const,
      bookingId: 'b1',
      serviceName: 'Botox',
      date: '2026-03-01',
      time: '14:00',
    };

    const result = await assistant.process('Yes', currentState, baseContext);
    expect(result.bookingId).toBe('b1');
    expect(result.serviceName).toBe('Botox');
  });

  it('includes staff name in auto-select response', async () => {
    const context = {
      ...baseContext,
      upcomingBookings: [baseContext.upcomingBookings[0]],
    };

    const result = await assistant.process('Cancel', null, context);
    expect(result.suggestedResponse).toContain('Dr. Smith');
  });

  it('returns fallback on error with no current state', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await assistant.process('Cancel', null, baseContext);
    expect(result.state).toBe('IDENTIFY_BOOKING');
    expect(result.suggestedResponse).toBeTruthy();
  });

  it('returns current state on error when state exists', async () => {
    const currentState = {
      state: 'CONFIRM_CANCEL' as const,
      bookingId: 'b1',
    };

    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await assistant.process('Yes', currentState, baseContext);
    expect(result).toBe(currentState);
  });
});
