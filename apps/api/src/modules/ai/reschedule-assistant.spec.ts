import { Test } from '@nestjs/testing';
import { RescheduleAssistant, RescheduleStateData } from './reschedule-assistant';
import { ClaudeClient } from './claude.client';
import { createMockClaudeClient } from '../../test/mocks';

describe('RescheduleAssistant', () => {
  let assistant: RescheduleAssistant;
  let claude: ReturnType<typeof createMockClaudeClient>;

  const baseContext = {
    businessName: 'Glow Clinic',
    personality: 'friendly and professional',
    upcomingBookings: [
      { id: 'b1', serviceId: 'svc1', serviceName: 'Botox', date: '2026-03-01', time: '14:00', staffId: 's1', staffName: 'Dr. Smith' },
      { id: 'b2', serviceId: 'svc2', serviceName: 'Facial', date: '2026-03-05', time: '10:00' },
    ],
  };

  beforeEach(async () => {
    claude = createMockClaudeClient();

    const module = await Test.createTestingModule({
      providers: [
        RescheduleAssistant,
        { provide: ClaudeClient, useValue: claude },
      ],
    }).compile();

    assistant = module.get(RescheduleAssistant);
  });

  it('auto-selects single booking and moves to IDENTIFY_NEW_DATE', async () => {
    const context = {
      ...baseContext,
      upcomingBookings: [baseContext.upcomingBookings[0]],
    };

    const result = await assistant.process('I want to reschedule', null, context);
    expect(result.state).toBe('IDENTIFY_NEW_DATE');
    expect(result.bookingId).toBe('b1');
    expect(result.serviceName).toBe('Botox');
    expect(result.originalDate).toBe('2026-03-01');
    expect(result.originalTime).toBe('14:00');
    expect(result.staffId).toBe('s1');
  });

  it('returns helpful message when no upcoming bookings', async () => {
    const result = await assistant.process('Reschedule', null, {
      ...baseContext,
      upcomingBookings: [],
    });

    expect(result.state).toBe('IDENTIFY_BOOKING');
    expect(result.suggestedResponse).toContain("don't have any upcoming");
  });

  it('transitions from IDENTIFY_NEW_DATE to IDENTIFY_NEW_TIME', async () => {
    const currentState: RescheduleStateData = {
      state: 'IDENTIFY_NEW_DATE',
      bookingId: 'b1',
      serviceId: 'svc1',
      serviceName: 'Botox',
      originalDate: '2026-03-01',
      originalTime: '14:00',
    };

    claude.complete.mockResolvedValue(JSON.stringify({
      state: 'IDENTIFY_NEW_TIME',
      newDate: '2026-03-08',
      suggestedResponse: 'Here are available times for March 8th',
      availableOptions: ['09:00', '10:00', '15:00'],
    }));

    const result = await assistant.process('March 8th', currentState, baseContext);
    expect(result.state).toBe('IDENTIFY_NEW_TIME');
    expect(result.newDate).toBe('2026-03-08');
    expect(result.bookingId).toBe('b1');
  });

  it('transitions from IDENTIFY_NEW_TIME to CONFIRM_RESCHEDULE', async () => {
    const currentState: RescheduleStateData = {
      state: 'IDENTIFY_NEW_TIME',
      bookingId: 'b1',
      serviceId: 'svc1',
      serviceName: 'Botox',
      originalDate: '2026-03-01',
      originalTime: '14:00',
      newDate: '2026-03-08',
    };

    claude.complete.mockResolvedValue(JSON.stringify({
      state: 'CONFIRM_RESCHEDULE',
      newTime: '10:00',
      newSlotIso: '2026-03-08T10:00:00',
      suggestedResponse: 'Move from March 1st to March 8th at 10am?',
    }));

    const result = await assistant.process('10am', currentState, baseContext);
    expect(result.state).toBe('CONFIRM_RESCHEDULE');
    expect(result.newTime).toBe('10:00');
    expect(result.newSlotIso).toBe('2026-03-08T10:00:00');
  });

  it('preserves existing state data on partial response', async () => {
    const currentState: RescheduleStateData = {
      state: 'IDENTIFY_NEW_DATE',
      bookingId: 'b1',
      serviceId: 'svc1',
      serviceName: 'Botox',
      originalDate: '2026-03-01',
      originalTime: '14:00',
      staffId: 's1',
      staffName: 'Dr. Smith',
    };

    claude.complete.mockResolvedValue(JSON.stringify({
      state: 'IDENTIFY_NEW_TIME',
      newDate: '2026-03-08',
      suggestedResponse: 'Pick a time',
    }));

    const result = await assistant.process('March 8th', currentState, baseContext);
    expect(result.bookingId).toBe('b1');
    expect(result.serviceId).toBe('svc1');
    expect(result.staffId).toBe('s1');
    expect(result.staffName).toBe('Dr. Smith');
    expect(result.originalDate).toBe('2026-03-01');
  });

  it('asks which booking when multiple exist', async () => {
    claude.complete.mockResolvedValue(JSON.stringify({
      state: 'IDENTIFY_BOOKING',
      suggestedResponse: 'Which appointment would you like to reschedule?',
    }));

    const result = await assistant.process('Reschedule', null, baseContext);
    expect(result.state).toBe('IDENTIFY_BOOKING');
    expect(claude.complete).toHaveBeenCalled();
  });

  it('returns fallback on error with no current state', async () => {
    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await assistant.process('Reschedule', null, baseContext);
    expect(result.state).toBe('IDENTIFY_BOOKING');
    expect(result.suggestedResponse).toBeTruthy();
  });

  it('returns current state on error when state exists', async () => {
    const currentState: RescheduleStateData = {
      state: 'IDENTIFY_NEW_DATE',
      bookingId: 'b1',
    };

    claude.complete.mockRejectedValue(new Error('API error'));

    const result = await assistant.process('March 8', currentState, baseContext);
    expect(result).toBe(currentState);
  });
});
