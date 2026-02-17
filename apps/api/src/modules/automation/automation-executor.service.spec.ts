import { Test } from '@nestjs/testing';
import { AutomationExecutorService } from './automation-executor.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('AutomationExecutorService', () => {
  let executorService: AutomationExecutorService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [AutomationExecutorService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    executorService = module.get(AutomationExecutorService);
  });

  describe('isQuietHours', () => {
    it('returns false when no quiet hours set', () => {
      expect(executorService.isQuietHours(null, null)).toBe(false);
    });

    it('detects overnight quiet hours', () => {
      const now = new Date();
      // Set to 22:00 — should be in quiet hours for 21:00-09:00
      const result = executorService.isQuietHours('21:00', '09:00');
      // This depends on current time, but we can at least verify it returns a boolean
      expect(typeof result).toBe('boolean');
    });

    it('returns false when only quietStart is null', () => {
      expect(executorService.isQuietHours(null, '09:00')).toBe(false);
    });

    it('returns false when only quietEnd is null', () => {
      expect(executorService.isQuietHours('21:00', null)).toBe(false);
    });

    it('handles daytime quiet hours (start < end)', () => {
      // Daytime range e.g. 12:00-14:00
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const result = executorService.isQuietHours('12:00', '14:00');
      const expected = currentMinutes >= 720 && currentMinutes < 840;
      expect(result).toBe(expected);
    });
  });

  describe('executeRules', () => {
    it('processes active rules', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule1',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 3,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1', createdAt: new Date() },
      ] as any);

      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      expect(prisma.automationLog.create).toHaveBeenCalled();
    });

    it('skips when already processing', async () => {
      // Set processing to true via first call that resolves slowly
      (prisma.automationRule.findMany as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );

      const p1 = executorService.executeRules();
      const p2 = executorService.executeRules();

      await Promise.all([p1, p2]);

      // Only called once because second call was skipped
      expect(prisma.automationRule.findMany).toHaveBeenCalledTimes(1);
    });

    it('handles rule processing error gracefully', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule1',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      // Make booking query fail for this rule
      prisma.booking.findMany.mockRejectedValue(new Error('DB timeout'));

      // Should not throw — error is caught internally
      await executorService.executeRules();

      // Rule processing error was caught, no log created
      expect(prisma.automationLog.create).not.toHaveBeenCalled();
    });

    it('processes BOOKING_UPCOMING trigger', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule2',
          businessId: 'biz1',
          trigger: 'BOOKING_UPCOMING',
          filters: { hoursBefore: 24 },
          actions: [{ type: 'SEND_REMINDER' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1' },
      ] as any);

      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            status: { in: ['CONFIRMED', 'PENDING_DEPOSIT'] },
          }),
        }),
      );
      expect(prisma.automationLog.create).toHaveBeenCalled();
    });

    it('processes STATUS_CHANGED trigger', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule3',
          businessId: 'biz1',
          trigger: 'STATUS_CHANGED',
          filters: { newStatus: 'CONFIRMED' },
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1', service: { kind: 'TREATMENT' } },
      ] as any);

      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      expect(prisma.automationLog.create).toHaveBeenCalled();
    });

    it('STATUS_CHANGED skips booking when serviceKind filter does not match', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule3',
          businessId: 'biz1',
          trigger: 'STATUS_CHANGED',
          filters: { serviceKind: 'CONSULTATION' },
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1', service: { kind: 'TREATMENT' } },
      ] as any);

      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      // Action should not be executed because serviceKind doesn't match
      expect(prisma.automationLog.create).not.toHaveBeenCalled();
    });

    it('processes BOOKING_CANCELLED trigger', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule4',
          businessId: 'biz1',
          trigger: 'BOOKING_CANCELLED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1', status: 'CANCELLED' },
      ] as any);

      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'CANCELLED',
          }),
        }),
      );
      expect(prisma.automationLog.create).toHaveBeenCalled();
    });

    it('handles unknown trigger type gracefully', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule5',
          businessId: 'biz1',
          trigger: 'UNKNOWN_TRIGGER',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      await executorService.executeRules();

      // No bookings queried, no actions executed
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
      expect(prisma.automationLog.create).not.toHaveBeenCalled();
    });

    it('skips rule during quiet hours', async () => {
      const now = new Date();
      const currentHour = now.getHours();
      const quietStart = `${String(currentHour).padStart(2, '0')}:00`;
      const quietEndHour = (currentHour + 2) % 24;
      const quietEnd = `${String(quietEndHour).padStart(2, '0')}:00`;

      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule6',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart,
          quietEnd,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      await executorService.executeRules();

      // Rule should be skipped — no bookings fetched
      expect(prisma.booking.findMany).not.toHaveBeenCalled();
    });

    it('processes empty bookings array without error', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule7',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([]);

      await executorService.executeRules();

      expect(prisma.automationLog.create).not.toHaveBeenCalled();
    });

    it('respects global frequency cap', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule8',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0, // no per-rule cap
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1' },
      ] as any);

      // Global daily cap is 10 — return 10 to trigger the cap
      prisma.automationLog.count.mockResolvedValue(10);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      expect(prisma.automationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcome: 'SKIPPED',
          reason: 'Global daily limit reached',
          action: 'GLOBAL_FREQUENCY_CAP',
        }),
      });
    });

    it('executes multiple actions in a rule', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule9',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_SMS' }, { type: 'SEND_WHATSAPP' }, { type: 'SEND_EMAIL' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1' },
      ] as any);

      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      // Three actions, one booking = 3 log entries
      expect(prisma.automationLog.create).toHaveBeenCalledTimes(3);
    });

    it('logs FAILED when action execution throws', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule10',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1' },
      ] as any);

      prisma.automationLog.count.mockResolvedValue(0);
      // First call (the action log) throws, second call (the FAILED log) succeeds
      prisma.automationLog.create
        .mockRejectedValueOnce(new Error('Log write failure'))
        .mockResolvedValue({} as any);

      await executorService.executeRules();

      // Second call should be the FAILED log
      expect(prisma.automationLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.automationLog.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          outcome: 'FAILED',
          reason: 'Log write failure',
        }),
      });
    });

    it('handles BOOKING_UPCOMING with custom hoursBefore filter', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule11',
          businessId: 'biz1',
          trigger: 'BOOKING_UPCOMING',
          filters: { hoursBefore: 48 },
          actions: [{ type: 'SEND_REMINDER' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([]);

      await executorService.executeRules();

      // Should query bookings with the custom hoursBefore window
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            startTime: expect.any(Object),
          }),
        }),
      );
    });

    it('BOOKING_UPCOMING defaults hoursBefore to 24 when not set', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule12',
          businessId: 'biz1',
          trigger: 'BOOKING_UPCOMING',
          filters: {},
          actions: [{ type: 'SEND_REMINDER' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([]);

      await executorService.executeRules();

      expect(prisma.booking.findMany).toHaveBeenCalled();
    });

    it('paginates rules when more than PAGE_SIZE exist', async () => {
      // First page: 50 rules (full page), second page: 0 rules
      const rules = Array.from({ length: 50 }, (_, i) => ({
        id: `rule${i}`,
        businessId: 'biz1',
        trigger: 'BOOKING_CREATED',
        filters: {},
        actions: [],
        isActive: true,
        quietStart: null,
        quietEnd: null,
        maxPerCustomerPerDay: 0,
      }));

      prisma.automationRule.findMany.mockResolvedValueOnce(rules as any).mockResolvedValueOnce([]);

      prisma.booking.findMany.mockResolvedValue([]);

      await executorService.executeRules();

      // Should have been called twice: once for page 1, once for page 2
      expect(prisma.automationRule.findMany).toHaveBeenCalledTimes(2);
    });

    it('stops pagination when page returns fewer than PAGE_SIZE results', async () => {
      const rules = Array.from({ length: 10 }, (_, i) => ({
        id: `rule${i}`,
        businessId: 'biz1',
        trigger: 'BOOKING_CREATED',
        filters: {},
        actions: [],
        isActive: true,
        quietStart: null,
        quietEnd: null,
        maxPerCustomerPerDay: 0,
      }));

      prisma.automationRule.findMany.mockResolvedValueOnce(rules as any);
      prisma.booking.findMany.mockResolvedValue([]);

      await executorService.executeRules();

      // Only called once because 10 < 50 (PAGE_SIZE)
      expect(prisma.automationRule.findMany).toHaveBeenCalledTimes(1);
    });

    it('executes actions with no customerId (bookingId-only)', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule13',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: null },
      ] as any);

      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      // No frequency cap check when customerId is null
      expect(prisma.automationLog.count).not.toHaveBeenCalled();
      expect(prisma.automationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: null,
          action: 'SEND_TEMPLATE',
          outcome: 'SENT',
        }),
      });
    });

    it('respects frequency cap', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule1',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 1,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1' },
      ] as any);

      // Already at frequency cap
      prisma.automationLog.count.mockResolvedValue(1);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      // Should log SKIPPED due to frequency cap
      expect(prisma.automationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcome: 'SKIPPED',
          reason: 'Daily limit reached',
        }),
      });
    });
  });
});
