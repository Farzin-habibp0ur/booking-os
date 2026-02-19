import { Test } from '@nestjs/testing';
import { SchedulingOptimizerService } from './scheduling-optimizer.service';
import { AgentFrameworkService } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('SchedulingOptimizerService', () => {
  let service: SchedulingOptimizerService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };
  let actionCardService: { create: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };
    actionCardService = { create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }) };

    const module = await Test.createTestingModule({
      providers: [
        SchedulingOptimizerService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ActionCardService, useValue: actionCardService },
      ],
    }).compile();

    service = module.get(SchedulingOptimizerService);
  });

  describe('onModuleInit', () => {
    it('registers itself with the agent framework', () => {
      service.onModuleInit();
      expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
    });
  });

  describe('agentType', () => {
    it('has SCHEDULING_OPTIMIZER agent type', () => {
      expect(service.agentType).toBe('SCHEDULING_OPTIMIZER');
    });
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });

    it('returns true for valid config', () => {
      expect(service.validateConfig({ maxCardsPerRun: 5, lookAheadDays: 3, gapThresholdMins: 30 })).toBe(true);
    });

    it('returns false for invalid gapThresholdMins (must be >= 15)', () => {
      expect(service.validateConfig({ gapThresholdMins: 10 })).toBe(false);
    });

    it('returns false for invalid maxCardsPerRun', () => {
      expect(service.validateConfig({ maxCardsPerRun: 0 })).toBe(false);
    });
  });

  describe('findGapsInSchedule', () => {
    const baseSchedule = {
      date: '2026-02-20',
      staffId: 'staff1',
      staffName: 'Sarah',
      workStart: 9 * 60, // 09:00
      workEnd: 17 * 60,  // 17:00
      bookings: [] as { startMins: number; endMins: number }[],
    };

    it('identifies entire day as gap when no bookings', () => {
      const gaps = service.findGapsInSchedule(baseSchedule, 60);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].gapStart).toBe('09:00');
      expect(gaps[0].gapEnd).toBe('17:00');
      expect(gaps[0].durationMins).toBe(480);
    });

    it('identifies gap before first booking', () => {
      const schedule = {
        ...baseSchedule,
        bookings: [{ startMins: 11 * 60, endMins: 12 * 60 }],
      };

      const gaps = service.findGapsInSchedule(schedule, 60);

      expect(gaps.some((g) => g.gapStart === '09:00' && g.gapEnd === '11:00')).toBe(true);
    });

    it('identifies gap between bookings', () => {
      const schedule = {
        ...baseSchedule,
        bookings: [
          { startMins: 9 * 60, endMins: 10 * 60 },
          { startMins: 12 * 60, endMins: 13 * 60 },
        ],
      };

      const gaps = service.findGapsInSchedule(schedule, 60);

      expect(gaps.some((g) => g.gapStart === '10:00' && g.gapEnd === '12:00')).toBe(true);
    });

    it('identifies gap after last booking', () => {
      const schedule = {
        ...baseSchedule,
        bookings: [{ startMins: 9 * 60, endMins: 10 * 60 }],
      };

      const gaps = service.findGapsInSchedule(schedule, 60);

      expect(gaps.some((g) => g.gapStart === '10:00' && g.gapEnd === '17:00')).toBe(true);
    });

    it('ignores gaps below threshold', () => {
      const schedule = {
        ...baseSchedule,
        bookings: [
          { startMins: 9 * 60, endMins: 10 * 60 },
          { startMins: 10 * 60 + 30, endMins: 12 * 60 }, // 30 min gap
        ],
      };

      const gaps = service.findGapsInSchedule(schedule, 60);

      // 30 min gap should not be included
      expect(gaps.every((g) => g.durationMins >= 60)).toBe(true);
    });

    it('handles back-to-back bookings (no gap)', () => {
      const schedule = {
        ...baseSchedule,
        workStart: 9 * 60,
        workEnd: 12 * 60,
        bookings: [
          { startMins: 9 * 60, endMins: 10 * 60 },
          { startMins: 10 * 60, endMins: 11 * 60 },
          { startMins: 11 * 60, endMins: 12 * 60 },
        ],
      };

      const gaps = service.findGapsInSchedule(schedule, 60);

      expect(gaps).toHaveLength(0);
    });

    it('includes staff info in gaps', () => {
      const gaps = service.findGapsInSchedule(baseSchedule, 60);

      expect(gaps[0].staffId).toBe('staff1');
      expect(gaps[0].staffName).toBe('Sarah');
      expect(gaps[0].date).toBe('2026-02-20');
    });
  });

  describe('execute', () => {
    it('returns 0 cards when no staff found', async () => {
      prisma.staff.findMany.mockResolvedValue([]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('creates action card for schedule gaps', async () => {
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Sarah' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      const result = await service.execute('biz1', { lookAheadDays: 1 });

      expect(result.cardsCreated).toBeGreaterThanOrEqual(1);
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          type: 'SCHEDULE_GAP',
          category: 'OPPORTUNITY',
          staffId: 'staff1',
        }),
      );
    });

    it('skips days where staff is off', async () => {
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Sarah' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
        isOff: true,
      } as any);

      const result = await service.execute('biz1', { lookAheadDays: 1 });

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('skips days where staff has time off', async () => {
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Sarah' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue({ id: 'to1' } as any);

      const result = await service.execute('biz1', { lookAheadDays: 1 });

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('deduplicates — skips if pending card exists for staff+date', async () => {
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Sarah' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.actionCard.findFirst.mockResolvedValue({ id: 'existing' } as any);

      const result = await service.execute('biz1', { lookAheadDays: 1 });

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('respects maxCardsPerRun', async () => {
      prisma.staff.findMany.mockResolvedValue([
        { id: 'staff1', name: 'Sarah' },
        { id: 'staff2', name: 'Emily' },
      ] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      const result = await service.execute('biz1', { maxCardsPerRun: 1, lookAheadDays: 1 });

      expect(result).toEqual({ cardsCreated: 1 });
    });

    it('includes gap details in preview', async () => {
      prisma.staff.findMany.mockResolvedValue([{ id: 'staff1', name: 'Sarah' }] as any);
      prisma.workingHours.findUnique.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await service.execute('biz1', { lookAheadDays: 1 });

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.preview.staffName).toBe('Sarah');
      expect(createArg.preview.gaps).toHaveLength(1);
      expect(createArg.preview.totalGapMins).toBe(480);
    });
  });

  describe('getDaySchedule', () => {
    it('returns null when staff has no working hours', async () => {
      prisma.workingHours.findUnique.mockResolvedValue(null);

      const result = await service.getDaySchedule('biz1', 'staff1', 'Sarah', '2026-02-20', 5);

      expect(result).toBeNull();
    });

    it('returns null when staff day is off', async () => {
      prisma.workingHours.findUnique.mockResolvedValue({ isOff: true } as any);

      const result = await service.getDaySchedule('biz1', 'staff1', 'Sarah', '2026-02-20', 5);

      expect(result).toBeNull();
    });

    it('returns null when staff has time off', async () => {
      prisma.workingHours.findUnique.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue({ id: 'to1' } as any);

      const result = await service.getDaySchedule('biz1', 'staff1', 'Sarah', '2026-02-20', 5);

      expect(result).toBeNull();
    });

    it('returns schedule with bookings', async () => {
      prisma.workingHours.findUnique.mockResolvedValue({
        startTime: '09:00',
        endTime: '17:00',
        isOff: false,
      } as any);
      prisma.timeOff.findFirst.mockResolvedValue(null);
      prisma.booking.findMany.mockResolvedValue([
        {
          startTime: new Date('2026-02-20T10:00:00'),
          endTime: new Date('2026-02-20T11:00:00'),
        },
      ] as any);

      const result = await service.getDaySchedule('biz1', 'staff1', 'Sarah', '2026-02-20', 5);

      expect(result).not.toBeNull();
      expect(result!.workStart).toBe(540); // 9 * 60
      expect(result!.workEnd).toBe(1020); // 17 * 60
      expect(result!.bookings).toHaveLength(1);
    });
  });
});
