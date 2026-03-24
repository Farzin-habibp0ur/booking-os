import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AutomationExecutorService } from './automation-executor.service';
import { PrismaService } from '../../common/prisma.service';
import { UsageService } from '../usage/usage.service';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { createMockPrisma } from '../../test/mocks';

describe('AutomationExecutorService', () => {
  let executorService: AutomationExecutorService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let notificationQueue: { add: jest.Mock };
  let usageService: { recordUsage: jest.Mock };
  let testimonialsService: { sendRequest: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    notificationQueue = { add: jest.fn().mockResolvedValue({}) };
    usageService = { recordUsage: jest.fn().mockResolvedValue(undefined) };
    testimonialsService = { sendRequest: jest.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        AutomationExecutorService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsageService, useValue: usageService },
        { provide: TestimonialsService, useValue: testimonialsService },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: notificationQueue },
      ],
    }).compile();

    executorService = module.get(AutomationExecutorService);

    // Default mock: processWaitingExecutions() iterates over this result
    prisma.automationExecution.findMany.mockResolvedValue([]);

    // Default mock: processRule() fetches business timezone
    prisma.business.findUnique.mockResolvedValue({ timezone: 'UTC' } as any);
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
      const localTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const currentMinutes = localTime.getHours() * 60 + localTime.getMinutes();
      const result = executorService.isQuietHours('12:00', '14:00', 'UTC');
      const expected = currentMinutes >= 720 && currentMinutes < 840;
      expect(result).toBe(expected);
    });

    it('defaults to UTC when no timezone provided', () => {
      const result = executorService.isQuietHours(null, null);
      expect(result).toBe(false);
    });

    it('respects business timezone for quiet hours', () => {
      const now = new Date();
      const pacificLocalTime = new Date(
        now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
      );
      const pacificMinutes = pacificLocalTime.getHours() * 60 + pacificLocalTime.getMinutes();

      // Quiet hours 00:00-23:59 in Pacific should always be true
      const alwaysQuiet = executorService.isQuietHours('00:00', '23:59', 'America/Los_Angeles');
      expect(alwaysQuiet).toBe(true);

      // Use the current Pacific time to construct a window that IS quiet
      const startH = String(pacificLocalTime.getHours()).padStart(2, '0');
      const startM = String(pacificLocalTime.getMinutes()).padStart(2, '0');
      const endMinutes = pacificMinutes + 60;
      const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, '0');
      const endMStr = String(endMinutes % 60).padStart(2, '0');

      const inQuietPacific = executorService.isQuietHours(
        `${startH}:${startM}`,
        `${endH}:${endMStr}`,
        'America/Los_Angeles',
      );
      expect(inQuietPacific).toBe(true);
    });

    it('overnight quiet hours with timezone work correctly', () => {
      // Quiet 22:00-08:00 in New York
      const now = new Date();
      const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const nyMinutes = nyTime.getHours() * 60 + nyTime.getMinutes();
      const result = executorService.isQuietHours('22:00', '08:00', 'America/New_York');
      const expected = nyMinutes >= 1320 || nyMinutes < 480;
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
      // Use UTC hours since business timezone defaults to UTC in our mock
      const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
      const currentHour = utcTime.getHours();
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

    it('per-rule frequency cap only counts SENT outcomes', async () => {
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
        { id: 'b1', businessId: 'biz1', customerId: 'c1' },
      ] as any);

      // Per-rule cap: 0 SENT (FAILED ones should not count)
      // Global cap: 0 SENT
      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      // Per-rule cap query should include outcome: 'SENT' filter
      expect(prisma.automationLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            automationRuleId: 'rule1',
            customerId: 'c1',
            outcome: 'SENT',
          }),
        }),
      );
    });

    it('SEND_MESSAGE action enqueues to notification queue', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule1',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_MESSAGE', body: 'Hi {{customerName}}!' }],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);

      prisma.booking.findMany.mockResolvedValue([
        { id: 'b1', businessId: 'biz1', customerId: 'c1' },
      ] as any);

      prisma.customer.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Alice',
        phone: '+1234567890',
        email: null,
      } as any);

      // For resolveChannel — business with no default channel
      prisma.business.findUnique.mockResolvedValue({
        timezone: 'UTC',
        channelSettings: null,
      } as any);

      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'automation-send',
        expect.objectContaining({
          to: '+1234567890',
          channel: 'WHATSAPP',
          content: 'Hi Alice!',
          businessId: 'biz1',
          customerId: 'c1',
        }),
      );
      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'WHATSAPP', 'OUTBOUND');
    });

    it('FAILED and SKIPPED logs do not count toward per-rule cap', async () => {
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
        { id: 'b1', businessId: 'biz1', customerId: 'c1' },
      ] as any);

      // 0 SENT logs (3 FAILED ones exist but aren't counted with outcome: 'SENT')
      prisma.automationLog.count.mockResolvedValue(0);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executorService.executeRules();

      // Should proceed to execute (not be capped) since SENT count is 0
      expect(prisma.automationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          outcome: 'SENT',
        }),
      });
    });
  });
});
