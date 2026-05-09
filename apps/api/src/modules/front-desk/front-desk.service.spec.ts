import { Test } from '@nestjs/testing';
import { FrontDeskService } from './front-desk.service';
import { FrontDeskAttributionService } from './front-desk-attribution.service';

describe('FrontDeskService', () => {
  let service: FrontDeskService;
  let attribution: { getSummary: jest.Mock };

  beforeEach(async () => {
    attribution = { getSummary: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        FrontDeskService,
        { provide: FrontDeskAttributionService, useValue: attribution },
      ],
    }).compile();

    service = module.get(FrontDeskService);
  });

  it('delegates to FrontDeskAttributionService.getSummary with the v3 shape', async () => {
    const v3Shape = {
      days: 30,
      captured: { count: 12, revenue: 4800 },
      wouldHaveBeenMissed: {
        count: 4,
        revenue: 1600,
        byReason: {
          WAITLIST_MATCH: { count: 1, revenue: 400 },
          AI_BOOKING: { count: 1, revenue: 400 },
          QUOTE_FOLLOWUP: { count: 1, revenue: 400 },
          CONSULT_FOLLOWUP: { count: 1, revenue: 400 },
          AFTER_HOURS_AI: { count: 0, revenue: 0 },
          UNANSWERED_THRESHOLD: { count: 0, revenue: 0 },
          ORGANIC: { count: 8, revenue: 3200 },
        },
      },
      responseTimeMedianMinutes: 7.5,
      baseline: {
        monthlyBookings: 30,
        monthlyRevenue: 12000,
        source: 'concierge_call',
        capturedAt: new Date('2026-04-01T00:00:00Z'),
      },
    };
    attribution.getSummary.mockResolvedValue(v3Shape);

    const result = await service.getSummary('biz1', 30);

    expect(attribution.getSummary).toHaveBeenCalledWith('biz1', 30);
    expect(result).toEqual(v3Shape);
    expect(result.captured.count).toBe(12);
    expect(result.wouldHaveBeenMissed.byReason.AI_BOOKING.count).toBe(1);
    expect(result.baseline.monthlyBookings).toBe(30);
  });

  it('passes through default 30-day window', async () => {
    attribution.getSummary.mockResolvedValue({
      days: 30,
      captured: { count: 0, revenue: 0 },
      wouldHaveBeenMissed: { count: 0, revenue: 0, byReason: {} },
      responseTimeMedianMinutes: null,
      baseline: {
        monthlyBookings: null,
        monthlyRevenue: null,
        source: 'concierge_call',
        capturedAt: null,
      },
    });

    await service.getSummary('biz1');

    expect(attribution.getSummary).toHaveBeenCalledWith('biz1', 30);
  });
});
