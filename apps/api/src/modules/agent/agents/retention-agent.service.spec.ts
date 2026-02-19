import { Test } from '@nestjs/testing';
import { RetentionAgentService } from './retention-agent.service';
import { AgentFrameworkService } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('RetentionAgentService', () => {
  let service: RetentionAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };
  let actionCardService: { create: jest.Mock };

  // Helper: create booking dates at intervals, with the LAST booking being lastBookingDaysAgo days ago
  function bookingDates(intervalDays: number, count: number, lastBookingDaysAgo: number): Date[] {
    const dates: Date[] = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      // First booking is furthest in the past
      const daysAgo = lastBookingDaysAgo + (count - 1 - i) * intervalDays;
      dates.push(new Date(now - daysAgo * 86400000));
    }
    return dates;
  }

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };
    actionCardService = { create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }) };

    const module = await Test.createTestingModule({
      providers: [
        RetentionAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ActionCardService, useValue: actionCardService },
      ],
    }).compile();

    service = module.get(RetentionAgentService);
  });

  describe('onModuleInit', () => {
    it('registers itself with the agent framework', () => {
      service.onModuleInit();
      expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
    });
  });

  describe('agentType', () => {
    it('has RETENTION agent type', () => {
      expect(service.agentType).toBe('RETENTION');
    });
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });

    it('returns true for valid config', () => {
      expect(
        service.validateConfig({
          maxCardsPerRun: 5,
          overdueThresholdMultiplier: 1.5,
          minBookings: 3,
          lookBackDays: 90,
        }),
      ).toBe(true);
    });

    it('returns false for invalid maxCardsPerRun', () => {
      expect(service.validateConfig({ maxCardsPerRun: 0 })).toBe(false);
    });

    it('returns false for invalid overdueThresholdMultiplier', () => {
      expect(service.validateConfig({ overdueThresholdMultiplier: 0.5 })).toBe(false);
    });

    it('returns false for invalid minBookings (must be >= 2)', () => {
      expect(service.validateConfig({ minBookings: 1 })).toBe(false);
    });

    it('returns false for invalid lookBackDays (must be >= 30)', () => {
      expect(service.validateConfig({ lookBackDays: 10 })).toBe(false);
    });
  });

  describe('execute', () => {
    it('returns 0 cards when no overdue customers', async () => {
      prisma.customer.findMany.mockResolvedValue([]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('creates retention card for overdue customer', async () => {
      // Customer with bookings every ~30 days, last one was 60 days ago (2x cadence)
      const dates = bookingDates(30, 3, 60);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'cust1',
          name: 'Jane Doe',
          bookings: dates.map((d, i) => ({
            startTime: d,
            service: { name: i === dates.length - 1 ? 'Facial Treatment' : 'Facial' },
          })),
        },
      ] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          type: 'RETENTION_DUE',
          category: 'OPPORTUNITY',
          title: expect.stringContaining('Jane Doe'),
          customerId: 'cust1',
        }),
      );
    });

    it('includes cadence data in description', async () => {
      const dates = bookingDates(30, 3, 60);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'cust1',
          name: 'Jane',
          bookings: dates.map((d) => ({
            startTime: d,
            service: { name: 'Facial' },
          })),
        },
      ] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.description).toContain('typically books every');
      expect(createArg.description).toContain('days since their last visit');
    });

    it('includes preview data in card', async () => {
      const dates = bookingDates(30, 3, 60);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'cust1',
          name: 'Jane',
          bookings: dates.map((d) => ({
            startTime: d,
            service: { name: 'Botox' },
          })),
        },
      ] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.preview.totalBookings).toBe(3);
      expect(createArg.preview.lastServiceName).toBe('Botox');
      expect(createArg.preview.avgDaysBetween).toBeGreaterThan(0);
    });

    it('skips customers with existing pending retention card', async () => {
      const dates = bookingDates(30, 3, 60);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'cust1',
          name: 'Jane',
          bookings: dates.map((d) => ({
            startTime: d,
            service: { name: 'Facial' },
          })),
        },
      ] as any);
      prisma.actionCard.findFirst.mockResolvedValue({ id: 'existing', status: 'PENDING' } as any);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('respects maxCardsPerRun config', async () => {
      const dates1 = bookingDates(30, 3, 60);
      const dates2 = bookingDates(30, 3, 75);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'A',
          bookings: dates1.map((d) => ({ startTime: d, service: { name: 'Facial' } })),
        },
        {
          id: 'c2',
          name: 'B',
          bookings: dates2.map((d) => ({ startTime: d, service: { name: 'Botox' } })),
        },
      ] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      const result = await service.execute('biz1', { maxCardsPerRun: 1 });

      expect(result).toEqual({ cardsCreated: 1 });
      expect(actionCardService.create).toHaveBeenCalledTimes(1);
    });

    it('continues on individual customer failure', async () => {
      const dates1 = bookingDates(30, 3, 60);
      const dates2 = bookingDates(30, 3, 60);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'A',
          bookings: dates1.map((d) => ({ startTime: d, service: { name: 'Facial' } })),
        },
        {
          id: 'c2',
          name: 'B',
          bookings: dates2.map((d) => ({ startTime: d, service: { name: 'Botox' } })),
        },
      ] as any);
      prisma.actionCard.findFirst
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(null);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
    });

    it('includes CTA config in card', async () => {
      const dates = bookingDates(30, 3, 60);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'cust1',
          name: 'Jane',
          bookings: dates.map((d) => ({ startTime: d, service: { name: 'Facial' } })),
        },
      ] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.ctaConfig).toEqual([
        { label: 'Send Follow-up', action: 'send_followup', variant: 'primary' },
        { label: 'Snooze', action: 'snooze', variant: 'secondary' },
        { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
      ]);
    });
  });

  describe('findOverdueCustomers', () => {
    it('returns empty array when no customers have enough bookings', async () => {
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'A',
          bookings: [{ startTime: new Date(), service: { name: 'Facial' } }],
        },
      ] as any);

      const result = await service.findOverdueCustomers('biz1', 1.5, 2, 180);

      expect(result).toEqual([]);
    });

    it('excludes customers within their normal cadence', async () => {
      // Customer books every 30 days, last booking was 20 days ago (within cadence)
      const dates = bookingDates(30, 3, 20);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'A',
          bookings: dates.map((d) => ({ startTime: d, service: { name: 'Facial' } })),
        },
      ] as any);

      const result = await service.findOverdueCustomers('biz1', 1.5, 2, 180);

      expect(result).toEqual([]);
    });

    it('identifies overdue customers correctly', async () => {
      // Customer books every 30 days, last booking was 60 days ago (2x cadence, exceeds 1.5x threshold)
      const dates = bookingDates(30, 3, 60);
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Jane',
          bookings: dates.map((d) => ({ startTime: d, service: { name: 'Botox' } })),
        },
      ] as any);

      const result = await service.findOverdueCustomers('biz1', 1.5, 2, 180);

      expect(result).toHaveLength(1);
      expect(result[0].customerId).toBe('c1');
      expect(result[0].customerName).toBe('Jane');
      expect(result[0].lastServiceName).toBe('Botox');
    });

    it('sorts by most overdue first', async () => {
      const dates1 = bookingDates(30, 3, 60); // 2x cadence
      const dates2 = bookingDates(30, 3, 90); // 3x cadence
      prisma.customer.findMany.mockResolvedValue([
        {
          id: 'c1',
          name: 'Less Overdue',
          bookings: dates1.map((d) => ({ startTime: d, service: { name: 'Facial' } })),
        },
        {
          id: 'c2',
          name: 'More Overdue',
          bookings: dates2.map((d) => ({ startTime: d, service: { name: 'Botox' } })),
        },
      ] as any);

      const result = await service.findOverdueCustomers('biz1', 1.5, 2, 180);

      expect(result[0].customerName).toBe('More Overdue');
    });
  });
});
