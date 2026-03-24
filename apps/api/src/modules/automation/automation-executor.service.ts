import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { UsageService } from '../usage/usage.service';
import { TestimonialsService } from '../testimonials/testimonials.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

@Injectable()
export class AutomationExecutorService {
  private readonly logger = new Logger(AutomationExecutorService.name);
  private processing = false;

  constructor(
    private prisma: PrismaService,
    private usageService: UsageService,
    @Inject(forwardRef(() => TestimonialsService))
    private testimonialsService: TestimonialsService,
    @Optional() @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationQueue?: Queue,
  ) {}

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
    // Fetch business timezone for quiet hours check
    const business = await this.prisma.business.findUnique({
      where: { id: rule.businessId },
      select: { timezone: true },
    });
    const timezone = business?.timezone || 'UTC';

    // Check quiet hours using business timezone
    if (this.isQuietHours(rule.quietStart, rule.quietEnd, timezone)) return;

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
            await this.startStepExecution(
              rule,
              steps,
              booking.businessId,
              booking.id,
              booking.customerId,
              booking,
            );
          } else {
            await this.executeActions(
              rule,
              actions,
              booking.businessId,
              booking.id,
              booking.customerId,
            );
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
            await this.startStepExecution(
              rule,
              steps,
              booking.businessId,
              booking.id,
              booking.customerId,
              booking,
            );
          } else {
            await this.executeActions(
              rule,
              actions,
              booking.businessId,
              booking.id,
              booking.customerId,
            );
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
            await this.startStepExecution(
              rule,
              steps,
              booking.businessId,
              booking.id,
              booking.customerId,
              booking,
            );
          } else {
            await this.executeActions(
              rule,
              actions,
              booking.businessId,
              booking.id,
              booking.customerId,
            );
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
            await this.startStepExecution(
              rule,
              steps,
              booking.businessId,
              booking.id,
              booking.customerId,
              booking,
            );
          } else {
            await this.executeActions(
              rule,
              actions,
              booking.businessId,
              booking.id,
              booking.customerId,
            );
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
    const sameLevelSteps = allSteps.filter((s: any) => s.parentStepId === currentStep.parentStepId);
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
          outcome: 'SENT',
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
        if (action.type === 'SEND_MESSAGE' && this.notificationQueue) {
          // Resolve customer info for message delivery
          const customer = customerId
            ? await this.prisma.customer.findUnique({
                where: { id: customerId },
                select: { id: true, name: true, phone: true, email: true },
              })
            : null;

          if (customer) {
            const channel = await this.resolveChannel(customer, businessId);
            const address = channel === 'EMAIL' ? customer.email : customer.phone;

            if (address) {
              // Render message template with customer data
              const messageContent = this.renderTemplate(action.body || action.message || '', {
                customerName: customer.name || 'there',
              });

              await this.notificationQueue.add('automation-send', {
                to: address,
                channel,
                content: messageContent,
                businessId,
                customerId: customer.id,
                automationRuleId: rule.id,
                bookingId: bookingId || null,
              });

              // Record usage for billing
              this.usageService
                .recordUsage(businessId, channel, 'OUTBOUND')
                .catch((err) => this.logger.error(`Usage recording failed: ${err.message}`));
            }
          }
        }

        // HIGH-06: REQUEST_TESTIMONIAL — send testimonial request to customer
        if (action.type === 'REQUEST_TESTIMONIAL' && customerId) {
          try {
            await this.testimonialsService.sendRequest(businessId, customerId);
          } catch (err: any) {
            this.logger.warn(
              `Testimonial request failed for customer ${customerId}: ${err.message}`,
            );
          }
        }

        // HIGH-06: SEND_EMAIL — send via EMAIL channel specifically
        if (
          action.type === 'SEND_EMAIL' &&
          action.subject &&
          action.body &&
          this.notificationQueue
        ) {
          const customer = customerId
            ? await this.prisma.customer.findUnique({
                where: { id: customerId },
                select: { id: true, email: true, name: true },
              })
            : null;
          if (customer?.email) {
            await this.notificationQueue.add('automation-email', {
              to: customer.email,
              subject: this.renderTemplate(action.subject, {
                customerName: customer.name || 'there',
              }),
              body: this.renderTemplate(action.body, { customerName: customer.name || 'there' }),
              businessId,
              customerId: customer.id,
            });
            this.usageService
              .recordUsage(businessId, 'EMAIL', 'OUTBOUND')
              .catch((err) => this.logger.error(`Usage recording failed: ${err.message}`));
          }
        }

        // HIGH-06: UPDATE_CUSTOMER_FIELD — safe field updates
        if (action.type === 'UPDATE_CUSTOMER_FIELD' && action.field && action.value && customerId) {
          const allowedFields = ['tags', 'notes', 'customFields'];
          if (allowedFields.includes(action.field)) {
            await this.prisma.customer.update({
              where: { id: customerId },
              data: { [action.field]: action.value },
            });
          }
        }

        // HIGH-06: WEBHOOK — call external URL with event data
        if (action.type === 'WEBHOOK' && action.url) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          try {
            await fetch(action.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: rule.trigger,
                businessId,
                customerId: customerId || null,
                bookingId: bookingId || null,
                timestamp: new Date().toISOString(),
                ...(action.payload || {}),
              }),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeout);
          }
        }

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

  // HIGH-05: Event-based trigger evaluation (called by other services)
  async evaluateTrigger(trigger: string, context: Record<string, any>) {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        businessId: context.businessId,
        trigger,
        isActive: true,
      },
    });

    for (const rule of rules) {
      try {
        // Fetch business timezone for quiet hours
        const business = await this.prisma.business.findUnique({
          where: { id: rule.businessId },
          select: { timezone: true },
        });
        const timezone = business?.timezone || 'UTC';

        if (this.isQuietHours(rule.quietStart, rule.quietEnd, timezone)) {
          await this.logAction(
            rule,
            context.businessId,
            context.bookingId,
            context.customerId,
            trigger,
            'SKIPPED',
            'Quiet hours',
          );
          continue;
        }

        // Check filters match context
        const filters = (rule.filters || {}) as Record<string, any>;
        if (!this.matchesFilters(filters, context)) continue;

        const actions = (rule.actions || []) as any[];
        await this.executeActions(
          rule,
          actions,
          context.businessId,
          context.bookingId,
          context.customerId,
        );
      } catch (err: any) {
        this.logger.error(`Event trigger ${trigger} rule ${rule.id} failed: ${err.message}`);
      }
    }
  }

  private matchesFilters(filters: Record<string, any>, context: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (context[key] !== undefined && context[key] !== value) {
        return false;
      }
    }
    return true;
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

  isQuietHours(
    quietStart?: string | null,
    quietEnd?: string | null,
    timezone: string = 'UTC',
  ): boolean {
    if (!quietStart || !quietEnd) return false;
    // Convert current UTC time to business local time
    const now = new Date();
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentMinutes = localTime.getHours() * 60 + localTime.getMinutes();
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

  private async resolveChannel(
    customer: { phone: string | null; email: string | null },
    businessId: string,
  ): Promise<string> {
    // Check business default channel
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { channelSettings: true },
    });
    const settings = business?.channelSettings as any;
    if (settings?.defaultReplyChannel) return settings.defaultReplyChannel;

    // Fallback to available channel
    if (customer.phone) return 'WHATSAPP';
    if (customer.email) return 'EMAIL';
    return 'WHATSAPP';
  }

  private renderTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
  }
}
