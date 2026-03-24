import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AutomationService } from './automation.service';
import { AutomationExecutorService } from './automation-executor.service';
import { PrismaService } from '../../common/prisma.service';
import { UsageService } from '../usage/usage.service';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { createMockPrisma } from '../../test/mocks';

describe('AutomationService — Step Management (P-13)', () => {
  let service: AutomationService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let testModule: any;

  beforeEach(async () => {
    prisma = createMockPrisma();
    testModule = await Test.createTestingModule({
      providers: [AutomationService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = testModule.get(AutomationService);
  });

  afterEach(async () => {
    await testModule?.close();
  });

  describe('getSteps', () => {
    it('returns steps ordered by order with child steps', async () => {
      prisma.automationRule.findFirst.mockResolvedValue({ id: 'r1' } as any);
      prisma.automationStep.findMany.mockResolvedValue([
        {
          id: 's1',
          order: 0,
          type: 'ACTION',
          config: { actionType: 'SEND_MESSAGE' },
          childSteps: [],
        },
        { id: 's2', order: 1, type: 'DELAY', config: { delayMinutes: 30 }, childSteps: [] },
      ] as any);

      const result = await service.getSteps('biz1', 'r1');

      expect(result).toHaveLength(2);
      expect(prisma.automationStep.findMany).toHaveBeenCalledWith({
        where: { automationRuleId: 'r1' },
        orderBy: { order: 'asc' },
        include: { childSteps: { orderBy: { order: 'asc' } } },
      });
    });

    it('throws NotFoundException for unknown rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);
      await expect(service.getSteps('biz1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setSteps', () => {
    it('replaces all steps in a transaction', async () => {
      prisma.automationRule.findFirst.mockResolvedValue({ id: 'r1' } as any);
      prisma.automationStep.deleteMany.mockResolvedValue({ count: 0 });
      prisma.automationStep.create
        .mockResolvedValueOnce({ id: 's1', order: 0, type: 'ACTION' } as any)
        .mockResolvedValueOnce({ id: 's2', order: 1, type: 'DELAY' } as any);

      const result = await service.setSteps('biz1', 'r1', [
        { order: 0, type: 'ACTION', config: { actionType: 'SEND_MESSAGE' } },
        { order: 1, type: 'DELAY', config: { delayMinutes: 60 } },
      ]);

      expect(result).toHaveLength(2);
      expect(prisma.automationStep.deleteMany).toHaveBeenCalledWith({
        where: { automationRuleId: 'r1' },
      });
      expect(prisma.automationStep.create).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException for unknown rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);
      await expect(service.setSteps('biz1', 'nope', [])).rejects.toThrow(NotFoundException);
    });

    it('creates steps with parentStepId and branchLabel', async () => {
      prisma.automationRule.findFirst.mockResolvedValue({ id: 'r1' } as any);
      prisma.automationStep.deleteMany.mockResolvedValue({ count: 0 });
      prisma.automationStep.create.mockResolvedValue({ id: 's1' } as any);

      await service.setSteps('biz1', 'r1', [
        {
          order: 0,
          type: 'BRANCH',
          config: { field: 'status', operator: 'is', value: 'CONFIRMED' },
        },
        {
          order: 1,
          type: 'ACTION',
          config: { actionType: 'SEND_MESSAGE' },
          parentStepId: 'parent1',
          branchLabel: 'true',
        },
      ]);

      expect(prisma.automationStep.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parentStepId: 'parent1',
          branchLabel: 'true',
        }),
      });
    });
  });

  describe('getExecutions', () => {
    it('returns paginated executions', async () => {
      prisma.automationRule.findFirst.mockResolvedValue({ id: 'r1' } as any);
      prisma.automationExecution.findMany.mockResolvedValue([
        { id: 'e1', status: 'COMPLETED' },
      ] as any);
      prisma.automationExecution.count.mockResolvedValue(1);

      const result = await service.getExecutions('biz1', 'r1', {});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('throws NotFoundException for unknown rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);
      await expect(service.getExecutions('biz1', 'nope', {})).rejects.toThrow(NotFoundException);
    });
  });
});

describe('AutomationExecutorService — Step Execution (P-13)', () => {
  let executor: AutomationExecutorService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let testModule: any;

  beforeEach(async () => {
    prisma = createMockPrisma();
    testModule = await Test.createTestingModule({
      providers: [
        AutomationExecutorService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: UsageService,
          useValue: { recordUsage: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: TestimonialsService,
          useValue: { sendRequest: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
          useValue: { add: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();
    executor = testModule.get(AutomationExecutorService);

    // Default mock: processWaitingExecutions() iterates over this result
    prisma.automationExecution.findMany.mockResolvedValue([]);
  });

  afterEach(async () => {
    await testModule?.close();
  });

  describe('evaluateBranch', () => {
    it('evaluates "is" operator correctly', () => {
      expect(
        executor.evaluateBranch(
          { field: 'status', operator: 'is', value: 'CONFIRMED' },
          { status: 'CONFIRMED' },
        ),
      ).toBe('true');
      expect(
        executor.evaluateBranch(
          { field: 'status', operator: 'is', value: 'CONFIRMED' },
          { status: 'CANCELLED' },
        ),
      ).toBe('false');
    });

    it('evaluates "isNot" operator correctly', () => {
      expect(
        executor.evaluateBranch(
          { field: 'status', operator: 'isNot', value: 'CANCELLED' },
          { status: 'CONFIRMED' },
        ),
      ).toBe('true');
    });

    it('evaluates "gt" operator correctly', () => {
      expect(
        executor.evaluateBranch({ field: 'amount', operator: 'gt', value: 100 }, { amount: 150 }),
      ).toBe('true');
      expect(
        executor.evaluateBranch({ field: 'amount', operator: 'gt', value: 100 }, { amount: 50 }),
      ).toBe('false');
    });

    it('evaluates "lt" operator correctly', () => {
      expect(
        executor.evaluateBranch({ field: 'amount', operator: 'lt', value: 100 }, { amount: 50 }),
      ).toBe('true');
    });

    it('returns false for missing field or operator', () => {
      expect(executor.evaluateBranch({}, { status: 'CONFIRMED' })).toBe('false');
      expect(executor.evaluateBranch({ field: 'status' }, { status: 'CONFIRMED' })).toBe('false');
    });

    it('returns false for unknown operator', () => {
      expect(
        executor.evaluateBranch(
          { field: 'status', operator: 'contains', value: 'X' },
          { status: 'CONFIRMED' },
        ),
      ).toBe('false');
    });
  });

  describe('advanceExecution', () => {
    it('executes ACTION step and completes when no more steps', async () => {
      const execution = {
        id: 'e1',
        automationRuleId: 'r1',
        businessId: 'biz1',
        bookingId: 'b1',
        customerId: 'c1',
        status: 'PENDING',
        context: { status: 'CONFIRMED' },
        step: {
          id: 's1',
          type: 'ACTION',
          config: { actionType: 'SEND_MESSAGE' },
          order: 0,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            {
              id: 's1',
              type: 'ACTION',
              config: { actionType: 'SEND_MESSAGE' },
              order: 0,
              parentStepId: null,
            },
          ],
        },
      };
      prisma.automationExecution.findUnique.mockResolvedValue(execution as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executor.advanceExecution('e1');

      // Should update to RUNNING, then COMPLETED
      expect(prisma.automationExecution.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: 'RUNNING' }),
      });
      expect(prisma.automationExecution.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });
      expect(prisma.automationLog.create).toHaveBeenCalled();
    });

    it('sets WAITING status for DELAY step', async () => {
      const execution = {
        id: 'e1',
        automationRuleId: 'r1',
        businessId: 'biz1',
        bookingId: null,
        customerId: null,
        status: 'PENDING',
        context: {},
        step: {
          id: 's1',
          type: 'DELAY',
          config: { delayMinutes: 30 },
          order: 0,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            { id: 's1', type: 'DELAY', config: { delayMinutes: 30 }, order: 0, parentStepId: null },
            {
              id: 's2',
              type: 'ACTION',
              config: { actionType: 'SEND_MESSAGE' },
              order: 1,
              parentStepId: null,
            },
          ],
        },
      };
      prisma.automationExecution.findUnique.mockResolvedValue(execution as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);

      await executor.advanceExecution('e1');

      expect(prisma.automationExecution.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: expect.objectContaining({
          status: 'WAITING',
          scheduledAt: expect.any(Date),
          stepId: 's2',
        }),
      });
    });

    it('follows correct branch for BRANCH step', async () => {
      const execution = {
        id: 'e1',
        automationRuleId: 'r1',
        businessId: 'biz1',
        bookingId: null,
        customerId: null,
        status: 'PENDING',
        context: { status: 'CONFIRMED' },
        step: {
          id: 's1',
          type: 'BRANCH',
          config: { field: 'status', operator: 'is', value: 'CONFIRMED' },
          order: 0,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            {
              id: 's1',
              type: 'BRANCH',
              config: { field: 'status', operator: 'is', value: 'CONFIRMED' },
              order: 0,
              parentStepId: null,
            },
            {
              id: 's2',
              type: 'ACTION',
              config: { actionType: 'SEND_MESSAGE' },
              order: 0,
              parentStepId: 's1',
              branchLabel: 'true',
            },
            {
              id: 's3',
              type: 'ACTION',
              config: { actionType: 'ADD_TAG', tag: 'lost' },
              order: 0,
              parentStepId: 's1',
              branchLabel: 'false',
            },
          ],
        },
      };
      // First call returns BRANCH execution; second (recursive) call returns ACTION execution
      const actionExecution = {
        ...execution,
        step: execution.automationRule.steps[1], // s2 ACTION step
      };
      prisma.automationExecution.findUnique
        .mockResolvedValueOnce(execution as any)
        .mockResolvedValueOnce(actionExecution as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executor.advanceExecution('e1');

      // Should advance to the 'true' branch (s2)
      expect(prisma.automationExecution.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: expect.objectContaining({ stepId: 's2', status: 'PENDING' }),
      });
    });

    it('sets FAILED status on error', async () => {
      const execution = {
        id: 'e1',
        automationRuleId: 'r1',
        businessId: 'biz1',
        bookingId: 'b1',
        customerId: 'c1',
        status: 'PENDING',
        context: {},
        step: {
          id: 's1',
          type: 'ACTION',
          config: { actionType: 'UPDATE_STATUS', newStatus: 'CONFIRMED' },
          order: 0,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            {
              id: 's1',
              type: 'ACTION',
              config: { actionType: 'UPDATE_STATUS', newStatus: 'CONFIRMED' },
              order: 0,
              parentStepId: null,
            },
          ],
        },
      };
      prisma.automationExecution.findUnique.mockResolvedValue(execution as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);

      // Make booking.update throw so executeStepAction fails
      prisma.booking.update.mockRejectedValue(new Error('Booking not found'));

      await executor.advanceExecution('e1');

      expect(prisma.automationExecution.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: 'FAILED', error: expect.any(String) }),
      });
    });

    it('skips already completed execution', async () => {
      prisma.automationExecution.findUnique.mockResolvedValue({
        id: 'e1',
        status: 'COMPLETED',
        step: { id: 's1' },
      } as any);

      await executor.advanceExecution('e1');

      expect(prisma.automationExecution.update).not.toHaveBeenCalled();
    });
  });

  describe('processWaitingExecutions', () => {
    it('advances waiting executions past their scheduledAt', async () => {
      const pastDate = new Date(Date.now() - 60000);
      prisma.automationExecution.findMany.mockResolvedValue([
        { id: 'e1', status: 'WAITING', scheduledAt: pastDate, stepId: 's2' },
      ] as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);
      prisma.automationExecution.findUnique.mockResolvedValue({
        id: 'e1',
        status: 'PENDING',
        context: {},
        step: {
          id: 's2',
          type: 'ACTION',
          config: { actionType: 'SEND_MESSAGE' },
          order: 1,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            {
              id: 's2',
              type: 'ACTION',
              config: { actionType: 'SEND_MESSAGE' },
              order: 1,
              parentStepId: null,
            },
          ],
        },
      } as any);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executor.processWaitingExecutions();

      expect(prisma.automationExecution.findMany).toHaveBeenCalledWith({
        where: { status: 'WAITING', scheduledAt: { lte: expect.any(Date) } },
        take: 50,
      });
      // Should have updated status to PENDING and then advanced
      expect(prisma.automationExecution.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { status: 'PENDING' },
      });
    });
  });

  describe('backward compatibility', () => {
    it('uses flat actions when rule has no steps', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule1',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [{ type: 'SEND_TEMPLATE' }],
          steps: [],
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
      prisma.automationExecution.findMany.mockResolvedValue([]);

      await executor.executeRules();

      // Should use flat actions path — log created directly
      expect(prisma.automationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'SEND_TEMPLATE',
          outcome: 'SENT',
        }),
      });
      // Should NOT create an execution
      expect(prisma.automationExecution.create).not.toHaveBeenCalled();
    });

    it('creates execution when rule has steps', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        {
          id: 'rule1',
          businessId: 'biz1',
          trigger: 'BOOKING_CREATED',
          filters: {},
          actions: [],
          steps: [
            {
              id: 's1',
              order: 0,
              type: 'ACTION',
              config: { actionType: 'SEND_MESSAGE' },
              parentStepId: null,
            },
          ],
          isActive: true,
          quietStart: null,
          quietEnd: null,
          maxPerCustomerPerDay: 0,
        },
      ] as any);
      prisma.booking.findMany.mockResolvedValue([
        {
          id: 'b1',
          businessId: 'biz1',
          customerId: 'c1',
          customer: { name: 'Alice' },
          service: { name: 'Facial' },
          status: 'CONFIRMED',
        },
      ] as any);
      prisma.automationExecution.findMany.mockResolvedValue([]);
      prisma.automationExecution.create.mockResolvedValue({ id: 'e1' } as any);
      prisma.automationExecution.findUnique.mockResolvedValue({
        id: 'e1',
        automationRuleId: 'rule1',
        businessId: 'biz1',
        bookingId: 'b1',
        customerId: 'c1',
        status: 'PENDING',
        context: {},
        step: {
          id: 's1',
          type: 'ACTION',
          config: { actionType: 'SEND_MESSAGE' },
          order: 0,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            {
              id: 's1',
              type: 'ACTION',
              config: { actionType: 'SEND_MESSAGE' },
              order: 0,
              parentStepId: null,
            },
          ],
        },
      } as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executor.executeRules();

      expect(prisma.automationExecution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          automationRuleId: 'rule1',
          stepId: 's1',
          status: 'PENDING',
        }),
      });
    });
  });

  describe('step action execution', () => {
    it('updates booking status for UPDATE_STATUS action', async () => {
      const execution = {
        id: 'e1',
        automationRuleId: 'r1',
        businessId: 'biz1',
        bookingId: 'b1',
        customerId: null,
        status: 'PENDING',
        context: {},
        step: {
          id: 's1',
          type: 'ACTION',
          config: { actionType: 'UPDATE_STATUS', newStatus: 'CONFIRMED' },
          order: 0,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            {
              id: 's1',
              type: 'ACTION',
              config: { actionType: 'UPDATE_STATUS', newStatus: 'CONFIRMED' },
              order: 0,
              parentStepId: null,
            },
          ],
        },
      };
      prisma.automationExecution.findUnique.mockResolvedValue(execution as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);
      prisma.booking.update.mockResolvedValue({} as any);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executor.advanceExecution('e1');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: 'CONFIRMED' },
      });
    });

    it('adds tag to customer for ADD_TAG action', async () => {
      const execution = {
        id: 'e1',
        automationRuleId: 'r1',
        businessId: 'biz1',
        bookingId: null,
        customerId: 'c1',
        status: 'PENDING',
        context: {},
        step: {
          id: 's1',
          type: 'ACTION',
          config: { actionType: 'ADD_TAG', tag: 'VIP' },
          order: 0,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            {
              id: 's1',
              type: 'ACTION',
              config: { actionType: 'ADD_TAG', tag: 'VIP' },
              order: 0,
              parentStepId: null,
            },
          ],
        },
      };
      prisma.automationExecution.findUnique.mockResolvedValue(execution as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', tags: ['existing'] } as any);
      prisma.customer.update.mockResolvedValue({} as any);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executor.advanceExecution('e1');

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { tags: ['existing', 'VIP'] },
      });
    });

    it('does not add duplicate tag', async () => {
      const execution = {
        id: 'e1',
        automationRuleId: 'r1',
        businessId: 'biz1',
        bookingId: null,
        customerId: 'c1',
        status: 'PENDING',
        context: {},
        step: {
          id: 's1',
          type: 'ACTION',
          config: { actionType: 'ADD_TAG', tag: 'VIP' },
          order: 0,
          parentStepId: null,
        },
        automationRule: {
          steps: [
            {
              id: 's1',
              type: 'ACTION',
              config: { actionType: 'ADD_TAG', tag: 'VIP' },
              order: 0,
              parentStepId: null,
            },
          ],
        },
      };
      prisma.automationExecution.findUnique.mockResolvedValue(execution as any);
      prisma.automationExecution.update.mockResolvedValue({} as any);
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', tags: ['VIP'] } as any);
      prisma.automationLog.create.mockResolvedValue({} as any);

      await executor.advanceExecution('e1');

      // Should not call customer.update since tag already exists
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });
  });
});
