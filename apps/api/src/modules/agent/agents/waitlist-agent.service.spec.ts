import { Test } from '@nestjs/testing';
import { WaitlistAgentService } from './waitlist-agent.service';
import { AgentFrameworkService } from '../agent-framework.service';
import { ActionCardService } from '../../action-card/action-card.service';
import { AvailabilityService } from '../../availability/availability.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('WaitlistAgentService', () => {
  let service: WaitlistAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };
  let actionCardService: { create: jest.Mock };
  let availabilityService: { getAvailableSlots: jest.Mock };

  const mockEntry = {
    id: 'wl1',
    businessId: 'biz1',
    customerId: 'cust1',
    serviceId: 'svc1',
    staffId: null,
    status: 'ACTIVE',
    timeWindowStart: null,
    timeWindowEnd: null,
    dateFrom: null,
    dateTo: null,
    customer: { id: 'cust1', name: 'Jane Doe' },
    service: { id: 'svc1', name: 'Facial Treatment', durationMins: 60 },
    staff: null,
  };

  const mockSlot = {
    time: '2026-02-20T10:00:00.000Z',
    display: '10:00',
    staffId: 'staff1',
    staffName: 'Sarah',
    available: true,
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };
    actionCardService = { create: jest.fn().mockResolvedValue({ id: 'card1', status: 'PENDING' }) };
    availabilityService = { getAvailableSlots: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        WaitlistAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ActionCardService, useValue: actionCardService },
        { provide: AvailabilityService, useValue: availabilityService },
      ],
    }).compile();

    service = module.get(WaitlistAgentService);
  });

  describe('onModuleInit', () => {
    it('registers itself with the agent framework', () => {
      service.onModuleInit();

      expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
    });
  });

  describe('agentType', () => {
    it('has WAITLIST agent type', () => {
      expect(service.agentType).toBe('WAITLIST');
    });
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });

    it('returns true for empty config', () => {
      expect(service.validateConfig({})).toBe(true);
    });

    it('returns true for valid config', () => {
      expect(service.validateConfig({ maxCardsPerRun: 5, lookAheadDays: 3, topSlots: 3 })).toBe(
        true,
      );
    });

    it('returns false for invalid maxCardsPerRun', () => {
      expect(service.validateConfig({ maxCardsPerRun: 0 })).toBe(false);
      expect(service.validateConfig({ maxCardsPerRun: 'five' })).toBe(false);
    });

    it('returns false for invalid lookAheadDays', () => {
      expect(service.validateConfig({ lookAheadDays: 0 })).toBe(false);
    });

    it('returns false for invalid topSlots', () => {
      expect(service.validateConfig({ topSlots: -1 })).toBe(false);
    });
  });

  describe('execute', () => {
    it('returns 0 cards when no active waitlist entries', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('creates action card when matching slots found', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([mockEntry] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);
      availabilityService.getAvailableSlots.mockResolvedValue([mockSlot]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
      expect(actionCardService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz1',
          type: 'WAITLIST_MATCH',
          category: 'OPPORTUNITY',
          priority: 70,
          title: 'Waitlist match for Jane Doe',
          customerId: 'cust1',
        }),
      );
    });

    it('includes slot preview data in card', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([mockEntry] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);
      availabilityService.getAvailableSlots.mockResolvedValueOnce([mockSlot]).mockResolvedValue([]);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.preview.serviceName).toBe('Facial Treatment');
      expect(createArg.preview.slots).toHaveLength(1);
      expect(createArg.preview.slots[0].display).toBe('10:00');
      expect(createArg.preview.slots[0].staffName).toBe('Sarah');
    });

    it('includes metadata with waitlist entry ID', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([mockEntry] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);
      availabilityService.getAvailableSlots.mockResolvedValueOnce([mockSlot]).mockResolvedValue([]);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.metadata.waitlistEntryId).toBe('wl1');
      expect(createArg.metadata.source).toBe('waitlist-agent');
    });

    it('skips entries with no available slots', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([mockEntry] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);
      availabilityService.getAvailableSlots.mockResolvedValue([{ ...mockSlot, available: false }]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('deduplicates — skips entries with existing pending card', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([mockEntry] as any);
      prisma.actionCard.findFirst.mockResolvedValue({
        id: 'existing-card',
        status: 'PENDING',
      } as any);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
      expect(actionCardService.create).not.toHaveBeenCalled();
    });

    it('respects maxCardsPerRun config', async () => {
      const entries = [
        { ...mockEntry, id: 'wl1', customerId: 'c1', customer: { id: 'c1', name: 'A' } },
        { ...mockEntry, id: 'wl2', customerId: 'c2', customer: { id: 'c2', name: 'B' } },
        { ...mockEntry, id: 'wl3', customerId: 'c3', customer: { id: 'c3', name: 'C' } },
      ];
      prisma.waitlistEntry.findMany.mockResolvedValue(entries as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);
      availabilityService.getAvailableSlots.mockResolvedValue([mockSlot]);

      const result = await service.execute('biz1', { maxCardsPerRun: 2 });

      expect(result).toEqual({ cardsCreated: 2 });
      expect(actionCardService.create).toHaveBeenCalledTimes(2);
    });

    it('continues on individual entry failure', async () => {
      const entries = [
        { ...mockEntry, id: 'wl1', customerId: 'c1', customer: { id: 'c1', name: 'A' } },
        { ...mockEntry, id: 'wl2', customerId: 'c2', customer: { id: 'c2', name: 'B' } },
      ];
      prisma.waitlistEntry.findMany.mockResolvedValue(entries as any);
      prisma.actionCard.findFirst
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(null);
      availabilityService.getAvailableSlots.mockResolvedValue([mockSlot]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
    });

    it('uses default config values', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([mockEntry] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);
      availabilityService.getAvailableSlots.mockResolvedValue([mockSlot]);

      await service.execute('biz1', null);

      // Should still work with null config (uses defaults)
      expect(actionCardService.create).toHaveBeenCalled();
    });

    it('includes CTA buttons in card', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([mockEntry] as any);
      prisma.actionCard.findFirst.mockResolvedValue(null);
      availabilityService.getAvailableSlots.mockResolvedValueOnce([mockSlot]).mockResolvedValue([]);

      await service.execute('biz1', {});

      const createArg = actionCardService.create.mock.calls[0][0];
      expect(createArg.ctaConfig).toEqual([
        { label: 'Offer Slot', action: 'offer_slot', variant: 'primary' },
        { label: 'Dismiss', action: 'dismiss', variant: 'ghost' },
      ]);
    });
  });

  describe('findMatchingSlots', () => {
    const entry = {
      id: 'wl1',
      customerId: 'cust1',
      serviceId: 'svc1',
      staffId: null,
      customer: { id: 'cust1', name: 'Jane' },
      service: { id: 'svc1', name: 'Facial', durationMins: 60 },
      staff: null,
      timeWindowStart: null,
      timeWindowEnd: null,
      dateFrom: null,
      dateTo: null,
    };

    it('returns matching available slots', async () => {
      availabilityService.getAvailableSlots
        .mockResolvedValueOnce([
          mockSlot,
          { ...mockSlot, time: '2026-02-20T11:00:00.000Z', display: '11:00' },
        ])
        .mockResolvedValue([]);

      const result = await service.findMatchingSlots('biz1', entry, 7, 3);

      expect(result).toHaveLength(2);
    });

    it('limits results to topSlots', async () => {
      availabilityService.getAvailableSlots
        .mockResolvedValueOnce([
          { ...mockSlot, display: '09:00' },
          { ...mockSlot, display: '10:00' },
          { ...mockSlot, display: '11:00' },
          { ...mockSlot, display: '12:00' },
        ])
        .mockResolvedValue([]);

      const result = await service.findMatchingSlots('biz1', entry, 7, 2);

      expect(result).toHaveLength(2);
    });

    it('filters by time window when set', async () => {
      const entryWithWindow = {
        ...entry,
        timeWindowStart: '10:00',
        timeWindowEnd: '12:00',
      };
      availabilityService.getAvailableSlots
        .mockResolvedValueOnce([
          { ...mockSlot, display: '09:00', available: true },
          { ...mockSlot, display: '10:30', available: true },
          { ...mockSlot, display: '11:00', available: true },
          { ...mockSlot, display: '13:00', available: true },
        ])
        .mockResolvedValue([]);

      const result = await service.findMatchingSlots('biz1', entryWithWindow, 1, 10);

      expect(result).toHaveLength(2);
      expect(result[0].display).toBe('10:30');
      expect(result[1].display).toBe('11:00');
    });

    it('skips dates outside date range preference', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const entryWithDateRange = {
        ...entry,
        dateFrom: nextWeek,
        dateTo: new Date(nextWeek.getTime() + 3 * 86400000),
      };

      availabilityService.getAvailableSlots.mockResolvedValue([mockSlot]);

      const result = await service.findMatchingSlots('biz1', entryWithDateRange, 3, 3);

      // lookAheadDays=3 but dateFrom is 7 days out, so no slots should match
      expect(result).toHaveLength(0);
    });

    it('passes preferred staffId to availability service', async () => {
      const entryWithStaff = {
        ...entry,
        staffId: 'staff1',
        staff: { id: 'staff1', name: 'Sarah' },
      };
      availabilityService.getAvailableSlots.mockResolvedValue([mockSlot]);

      await service.findMatchingSlots('biz1', entryWithStaff, 1, 3);

      expect(availabilityService.getAvailableSlots).toHaveBeenCalledWith(
        'biz1',
        expect.any(String),
        'svc1',
        'staff1',
      );
    });

    it('handles availability service errors gracefully', async () => {
      availabilityService.getAvailableSlots.mockRejectedValue(new Error('Service error'));

      const result = await service.findMatchingSlots('biz1', entry, 3, 3);

      expect(result).toHaveLength(0);
    });

    it('filters out unavailable slots', async () => {
      availabilityService.getAvailableSlots
        .mockResolvedValueOnce([
          { ...mockSlot, available: true },
          { ...mockSlot, display: '11:00', available: false },
        ])
        .mockResolvedValue([]);

      const result = await service.findMatchingSlots('biz1', entry, 1, 10);

      expect(result).toHaveLength(1);
      expect(result[0].display).toBe('10:00');
    });
  });
});
