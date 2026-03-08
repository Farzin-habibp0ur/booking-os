import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

export interface DunningEmail {
  step: number;
  delayMs: number;
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaPath: string;
}

/**
 * 3-email dunning sequence + auto-downgrade after 14 days.
 *
 * Triggered by `invoice.payment_failed` Stripe webhook.
 * Canceled when `invoice.paid` arrives (payment recovered).
 */
export const DUNNING_EMAILS: DunningEmail[] = [
  {
    step: 1,
    delayMs: 0, // Immediately
    subject: 'Action required: Your payment failed',
    headline: 'Payment failed',
    body: 'We were unable to process your latest payment. Please update your payment method to avoid any interruption to your Booking OS service.',
    ctaLabel: 'Update Payment Method',
    ctaPath: '/settings/billing',
  },
  {
    step: 2,
    delayMs: 3 * 24 * 60 * 60 * 1000, // 3 days
    subject: 'Your Booking OS account may be restricted',
    headline: 'Account at risk',
    body: 'Your payment is still outstanding. If we cannot collect payment within the next few days, your account features will be restricted. Please update your payment method now to keep your account fully active.',
    ctaLabel: 'Update Payment Method',
    ctaPath: '/settings/billing',
  },
  {
    step: 3,
    delayMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    subject: 'Final notice: Your account will be downgraded',
    headline: 'Final notice before downgrade',
    body: 'This is your final reminder. Your payment has been overdue for 7 days. If payment is not received within the next 7 days, your account will be automatically downgraded to the Starter plan. All your data will be preserved, but premium features will be disabled.',
    ctaLabel: 'Update Payment Method',
    ctaPath: '/settings/billing',
  },
];

/** Auto-downgrade delay: 14 days after initial payment failure */
export const DUNNING_DOWNGRADE_DELAY_MS = 14 * 24 * 60 * 60 * 1000;

export interface DunningJobData {
  businessId: string;
  email: string;
  name: string;
  step: number;
}

export interface DunningDowngradeJobData {
  businessId: string;
}

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    @Inject('QUEUE_AVAILABLE') private queueAvailable: boolean,
    @Optional()
    @InjectQueue(QUEUE_NAMES.DUNNING)
    private dunningQueue?: Queue,
  ) {}

  /**
   * Schedule the full dunning sequence for a business with a failed payment.
   * Called from BillingService.handlePaymentFailed().
   */
  async scheduleDunning(businessId: string, email: string, name: string): Promise<void> {
    if (!this.queueAvailable || !this.dunningQueue) {
      this.logger.warn(
        `No queue available — dunning emails will not be sent for business ${businessId}`,
      );
      return;
    }

    // Schedule each dunning email as a delayed job
    for (const dunning of DUNNING_EMAILS) {
      await this.dunningQueue.add(
        `dunning-step-${dunning.step}`,
        { businessId, email, name, step: dunning.step } satisfies DunningJobData,
        {
          delay: dunning.delayMs,
          jobId: `dunning-${businessId}-step-${dunning.step}`,
          removeOnComplete: true,
          removeOnFail: { count: 3 },
        },
      );
    }

    // Schedule auto-downgrade after 14 days
    await this.dunningQueue.add(
      'dunning-downgrade',
      { businessId } satisfies DunningDowngradeJobData,
      {
        delay: DUNNING_DOWNGRADE_DELAY_MS,
        jobId: `dunning-${businessId}-downgrade`,
        removeOnComplete: true,
        removeOnFail: { count: 3 },
      },
    );

    this.logger.log(
      `Scheduled dunning sequence (3 emails + downgrade) for business ${businessId}`,
    );
  }

  /**
   * Process a single dunning email step.
   * Called by the processor.
   */
  async sendDunningEmail(data: DunningJobData): Promise<void> {
    const { businessId, email, name, step } = data;

    // Verify business still exists and is still past_due
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) {
      this.logger.log(`Skipping dunning step ${step} — no subscription for business ${businessId}`);
      return;
    }

    // If payment has been recovered, skip
    if (subscription.status === 'active') {
      this.logger.log(
        `Skipping dunning step ${step} — business ${businessId} payment recovered`,
      );
      return;
    }

    const dunningEmail = DUNNING_EMAILS.find((d) => d.step === step);
    if (!dunningEmail) return;

    const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');

    try {
      await this.emailService.sendGeneric(email, {
        subject: dunningEmail.subject,
        headline: dunningEmail.headline,
        body: dunningEmail.body,
        ctaLabel: dunningEmail.ctaLabel,
        ctaUrl: `${webUrl}${dunningEmail.ctaPath}`,
      });
      this.logger.log(`Sent dunning step ${step} to ${email} (business ${businessId})`);
    } catch (err) {
      this.logger.warn(
        `Failed to send dunning step ${step} to ${email}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Auto-downgrade a business to starter plan after 14 days of failed payment.
   */
  async processDowngrade(data: DunningDowngradeJobData): Promise<void> {
    const { businessId } = data;

    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) {
      this.logger.log(`Skipping downgrade — no subscription for business ${businessId}`);
      return;
    }

    // Only downgrade if still past_due (payment wasn't recovered)
    if (subscription.status !== 'past_due') {
      this.logger.log(
        `Skipping downgrade — business ${businessId} status is ${subscription.status}, not past_due`,
      );
      return;
    }

    // Downgrade to starter plan
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan: 'starter',
        status: 'active',
      },
    });

    this.logger.log(`Auto-downgraded business ${businessId} to starter plan after 14 days`);

    // Notify the admin
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: { staff: { where: { role: 'ADMIN' }, take: 1 } },
      });

      if (business?.staff[0]) {
        const staff = business.staff[0];
        const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
        await this.emailService.sendGeneric(staff.email, {
          subject: 'Your Booking OS account has been downgraded',
          headline: 'Account downgraded to Starter',
          body: 'Due to an unresolved payment issue, your account has been downgraded to the Starter plan. All your data has been preserved. Upgrade anytime to restore your premium features.',
          ctaLabel: 'Upgrade Now',
          ctaUrl: `${webUrl}/settings/billing`,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to send downgrade notification for business ${businessId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Cancel all pending dunning jobs for a business.
   * Called when payment succeeds (invoice.paid webhook).
   */
  async cancelDunning(businessId: string): Promise<void> {
    if (!this.queueAvailable || !this.dunningQueue) return;

    // Cancel email steps
    for (const dunning of DUNNING_EMAILS) {
      const jobId = `dunning-${businessId}-step-${dunning.step}`;
      try {
        const job = await this.dunningQueue.getJob(jobId);
        if (job && (await job.isDelayed())) {
          await job.remove();
        }
      } catch {
        // Job may already be processed or removed
      }
    }

    // Cancel downgrade job
    try {
      const downgradeJobId = `dunning-${businessId}-downgrade`;
      const job = await this.dunningQueue.getJob(downgradeJobId);
      if (job && (await job.isDelayed())) {
        await job.remove();
      }
    } catch {
      // Job may already be processed or removed
    }

    this.logger.log(`Canceled dunning sequence for business ${businessId}`);
  }
}
