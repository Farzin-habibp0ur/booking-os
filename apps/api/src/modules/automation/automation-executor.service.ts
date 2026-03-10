import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AutomationExecutorService {
  private readonly logger = new Logger(AutomationExecutorService.name);
  private processing = false;

  constructor(private prisma: PrismaService) {}

  // H5 fix: Paginated execution with time limit to prevent resource exhaustion
  private static readonly PAGE_SIZE = 50;
  private static readonly MAX_EXECUTION_MS = 50_000; // 50s limit (10s buffer before next cron)

  @Cron(CronExpression.EVERY_MINUTE)
  async executeRules() {
    if (this.processing) return;
    this.processing = true;
    const startTime = Date.now();
    try {
      // P-13: Process waiting step executions first
      await this.processWaitingExecutions();

      let skip = 0;
      while (true) {
        if (Date.now() - startTime > AutomationExecutorService.MAX_EXECUTION_MS) {
          this.logger.warn('Automation execution time limit reached, deferring remaining rules');
          break;
        }

        const rules = await this.prisma.automationRule.findMany({
          where: { isActive: true },
          take: AutomationExecutorService.PAGE_SIZE,
          skip,
          orderBy: { id: 'asc' },
          include: { steps: { orderBy: { order: 'asc' } } },
        });
        if (rules.length === 0) break;

        for (const rule of rules) {
          if (Date.now() - startTime > AutomationExecutorService.MAX_EXECUTION_MS) break;
          try {
            await this.processRule(rule);
          } catch (err: any) {
            this.logger.error(`Automation rule ${rule.id} failed: ${err.message}`);
          }
        }

        skip += AutomationExecutorService.PAGE_SIZE;
        if (rules.length < AutomationExecutorService.PAGE_SIZE) break;
      }
    } finally {
      this.processing = false;
    }
  }

  private async processRule(rule: any) {
    // Check quiet hours
    if (this.isQuietHours(rule.quietStart, rule.quietEnd)) return;

    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const filters = rule.filters || {};
    const actions = (rule.actions || []) as any[];
    const steps = (rule.steps || []) as any[];
    const hasSteps = steps.length > 0;

    switch (rule.trigger) {
      case 'BOOKING_CREATED': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId: rule.businessId,
            createdAt: { gte: twoMinutesAgo },
          },
          include: { customer: true, service: true },
        });
        for (const booking of bookings) {
          if (hasSteps) {
            await this.startStepExecution(rule, steps, booking.businessId, booking.id, booking.customerId, booking);
          } else {
            await this.executeActions(rule, actions, booking.businessId, booking.id, booking.customerId);
          }
        }
        break;
      }
      case 'BOOKING_UPCOMING': {
        const hoursBefore = filters.hoursBefore || 24;
        const windowStart = new Date(now.getTime() + (hoursBefore - 1) * 60 * 60 * 1000);
        const windowEnd = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId: rule.businessId,
            startTime: { gte: windowStart, lt: windowEnd },
            status: { in: ['CONFIRMED', 'PENDING_DEPOSIT'] },
          },
          include: { customer: true },
        });
        for (const booking of bookings) {
          if (hasSteps) {
            await this.startStepExecution(rule, steps, booking.businessId, booking.id, booking.customerId, booking);
          } else {
            await this.executeActions(rule, actions, booking.businessId, booking.id, booking.customerId);
          }
        }
        break;
      }
      case 'STATUS_CHANGED': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId: rule.businessId,
            updatedAt: { gte: twoMinutesAgo },
            ...(filters.newStatus && { status: filters.newStatus }),
          },
          include: { service: true, customer: true },
        });
        for (const booking of bookings) {
          if (filters.serviceKind && booking.service?.kind !== filters.serviceKind) continue;
          if (hasSteps) {
            await this.startStepExecution(rule, steps, booking.businessId, booking.id, booking.customerId, booking);
          } else {
            await this.executeActions(rule, actions, booking.businessId, booking.id, booking.customerId);
          }
        }
        break;
      }
      case 'BOOKING_CANCELLED': {
        const bookings = await this.prisma.booking.findMany({
          where: {
            businessId: rule.businessId,
            status: 'CANCELLED',
            updatedAt: { gte: twoMinutesAgo },
          },
          include: { customer: true },
        });
        for (const booking of bookings) {
          if (hasSteps) {
            await this.startStepExecution(rule, steps, booking.businessId, booking.id, booking.customerId, booking);
          } else {
            await this.executeActions(rule, actions, booking.businessId, booking.id, booking.customerId);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // P-13: Start a step-based execution sequence
  private async startStepExecution(
    rule: any,
    steps: any[],
    businessId: string,
    bookingId?: string,
    customerId?: string,
    bookingData?: any,
  ) {
    const firstStep = steps.find((s: any) => s.order === 0 && !s.parentStepId) || steps[0];
    if (!firstStep) return;

    const context = {
      bookingId,
      customerId,
      status: bookingData?.status,
      serviceName: bookingData?.service?.name,
      customerName: bookingData?.customer?.name,
    };

    const execution = await this.prisma.automationExecution.create({
      data: {
        automationRuleId: rule.id,
        stepId: firstStep.id,
        businessId,
        customerId: customerId || null,
        bookingId: bookingId || null,
        status: 'PENDING',
        context,
      },
    });

    await this.advanceExecution(execution.id);
  }

  // P-13: Advance an execution to the next step
  async advanceExecution(executionId: string) {
    const execution = await this.prisma.automationExecution.findUnique({
      where: { id: executionId },
      include: {
        step: true,
        automationRule: { include: { steps: { orderBy: { order: 'asc' } } } },
      },
    });

    if (!execution || !execution.step) return;
    if (execution.status === 'COMPLETED' || execution.status === 'FAILED') return;

    const step = execution.step;
    const allSteps = execution.automationRule.steps;
    const context = (execution.context || {}) as Record<string, any>;

    try {
      await this.prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const stepConfig = (step.config || {}) as Record<string, any>;

      if (step.type === 'ACTION') {
        await this.executeStepAction(execution, stepConfig);
        const nextStep = this.findNextStep(allSteps, step);
        if (nextStep) {
          await this.prisma.automationExecution.update({
            where: { id: executionId },
            data: { stepId: nextStep.id, status: 'PENDING' },
          });
          await this.advanceExecution(executionId);
        } else {
          await this.prisma.automationExecution.update({
            where: { id: executionId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }
      } else if (step.type === 'DELAY') {
        const delayMinutes = stepConfig.delayMinutes || 0;
        const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);
        const nextStep = this.findNextStep(allSteps, step);
        await this.prisma.automationExecution.update({
          where: { id: executionId },
          data: {
            status: 'WAITING',
            scheduledAt,
            stepId: nextStep?.id || step.id,
          },
        });
      } else if (step.type === 'BRANCH') {
        const branchResult = this.evaluateBranch(stepConfig, context);
        const childSteps = allSteps.filter(
          (s: any) => s.parentStepId === step.id && s.branchLabel === branchResult,
        );
        const nextChild = childSteps[0];
        if (nextChild) {
          await this.prisma.automationExecution.update({
            where: { id: executionId },
            data: { stepId: nextChild.id, status: 'PENDING' },
          });
          await this.advanceExecution(executionId);
        } else {
          // No matching branch child — find next sibling step
          const nextStep = this.findNextStep(allSteps, step);
          if (nextStep) {
            await this.prisma.automationExecution.update({
              where: { id: executionId },
              data: { stepId: nextStep.id, status: 'PENDING' },
            });
            await this.advanceExecution(executionId);
          } else {
            await this.prisma.automationExecution.update({
              where: { id: executionId },
              data: { status: 'COMPLETED', completedAt: new Date() },
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Execution ${executionId} step ${step.id} failed: ${err.message}`);
      await this.prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: 'FAILED', error: err.message, completedAt: new Date() },
      });
    }
  }

  // P-13: Execute an ACTION type step
  private async executeStepAction(execution: any, config: Record<string, any>) {
    const actionType = config.actionType || 'SEND_MESSAGE';

    if (actionType === 'UPDATE_STATUS' && config.newStatus && execution.bookingId) {
      await this.prisma.booking.update({
        where: { id: execution.bookingId },
        data: { status: config.newStatus },
      });
    }

    if (actionType === 'ADD_TAG' && config.tag && execution.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: execution.customerId },
        select: { tags: true },
      });
      if (customer) {
        const tags = (customer.tags || []) as string[];
        if (!tags.includes(config.tag)) {
          await this.prisma.customer.update({
            where: { id: execution.customerId },
            data: { tags: [...tags, config.tag] },
          });
        }
      }
    }

    // Log all actions to AutomationLog
    await this.prisma.automationLog.create({
      data: {
        automationRuleId: execution.automationRuleId,
        businessId: execution.businessId,
        bookingId: execution.bookingId || null,
        customerId: execution.customerId || null,
        action: actionType,
        outcome: 'SENT',
      },
    });
  }

  // P-13: Find the next sequential step (by order, same parent level)
  private findNextStep(allSteps: any[], currentStep: any): any | null {
    const sameLevelSteps = allSteps.filter(
      (s: any) => s.parentStepId === currentStep.parentStepId,
    );
    const currentIndex = sameLevelSteps.findIndex((s: any) => s.id === currentStep.id);
    return currentIndex >= 0 && currentIndex < sameLevelSteps.length - 1
      ? sameLevelSteps[currentIndex + 1]
      : null;
  }

  // P-13: Evaluate a branch condition against execution context
  evaluateBranch(config: Record<string, any>, context: Record<string, any>): string {
    const { field, operator, value } = config;
    if (!field || !operator) return 'false';
    const actual = context[field];

    switch (operator) {
      case 'is':
        return String(actual) === String(value) ? 'true' : 'false';
      case 'isNot':
        return String(actual) !== String(value) ? 'true' : 'false';
      case 'gt':
        return Number(actual) > Number(value) ? 'true' : 'false';
      case 'lt':
        return Number(actual) < Number(value) ? 'true' : 'false';
      default:
        return 'false';
    }
  }

  // P-13: Process executions waiting for delay to elapse
  async processWaitingExecutions() {
    const now = new Date();
    const waiting = await this.prisma.automationExecution.findMany({
      where: {
        status: 'WAITING',
        scheduledAt: { lte: now },
      },
      take: AutomationExecutorService.PAGE_SIZE,
    });

    for (const execution of waiting) {
      try {
        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: { status: 'PENDING' },
        });
        await this.advanceExecution(execution.id);
      } catch (err: any) {
        this.logger.error(`Waiting execution ${execution.id} failed: ${err.message}`);
      }
    }
  }

  // M14 fix: Global per-customer daily cap across ALL rules (prevents multi-rule spam)
  private static readonly GLOBAL_MAX_PER_CUSTOMER_PER_DAY = 10;

  private async executeActions(
    rule: any,
    actions: any[],
    businessId: string,
    bookingId?: string,
    customerId?: string,
  ) {
    // Check per-rule frequency cap
    if (customerId && rule.maxPerCustomerPerDay > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = await this.prisma.automationLog.count({
        where: {
          automationRuleId: rule.id,
          customerId,
          createdAt: { gte: today },
        },
      });
      if (todayCount >= rule.maxPerCustomerPerDay) {
        await this.logAction(
          rule,
          businessId,
          bookingId,
          customerId,
          'FREQUENCY_CAP',
          'SKIPPED',
          'Daily limit reached',
        );
        return;
      }
    }

    // M14 fix: Global per-customer cap across all rules
    if (customerId) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const globalTodayCount = await this.prisma.automationLog.count({
        where: {
          customerId,
          businessId,
          outcome: 'SENT',
          createdAt: { gte: today },
        },
      });
      if (globalTodayCount >= AutomationExecutorService.GLOBAL_MAX_PER_CUSTOMER_PER_DAY) {
        await this.logAction(
          rule,
          businessId,
          bookingId,
          customerId,
          'GLOBAL_FREQUENCY_CAP',
          'SKIPPED',
          'Global daily limit reached',
        );
        return;
      }
    }

    for (const action of actions) {
      try {
        // For now, log the action; real implementation would call notification service
        await this.logAction(rule, businessId, bookingId, customerId, action.type, 'SENT');
      } catch (err: any) {
        await this.logAction(
          rule,
          businessId,
          bookingId,
          customerId,
          action.type,
          'FAILED',
          err.message,
        );
      }
    }
  }

  private async logAction(
    rule: any,
    businessId: string,
    bookingId?: string,
    customerId?: string,
    action?: string,
    outcome?: string,
    reason?: string,
  ) {
    await this.prisma.automationLog.create({
      data: {
        automationRuleId: rule.id,
        businessId,
        bookingId: bookingId || null,
        customerId: customerId || null,
        action: action || 'UNKNOWN',
        outcome: outcome || 'SENT',
        reason: reason || null,
      },
    });
  }

  isQuietHours(quietStart?: string | null, quietEnd?: string | null): boolean {
    if (!quietStart || !quietEnd) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    // Overnight quiet hours (e.g., 21:00 - 09:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}
