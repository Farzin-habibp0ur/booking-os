import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

export interface DripEmail {
  step: number;
  delayHours: number;
  subject: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaPath?: string;
}

/**
 * 13-email onboarding drip sequence.
 * Delays are relative to signup time.
 */
export const DRIP_EMAILS: DripEmail[] = [
  {
    step: 1,
    delayHours: 1,
    subject: 'Quick win: Add your first service in 2 minutes',
    headline: 'Set up your first service',
    body: 'You signed up — great start! The fastest way to see Booking OS in action is to create your first service. It takes under 2 minutes and unlocks your online booking page.',
    ctaLabel: 'Add a Service',
    ctaPath: '/services',
  },
  {
    step: 2,
    delayHours: 24,
    subject: 'Your booking page is live — share it with clients',
    headline: 'Share your booking link',
    body: "Your online booking page is ready. Share the link with your clients so they can self-book appointments. You'll get instant notifications for every new booking.",
    ctaLabel: 'View Booking Page',
    ctaPath: '/settings',
  },
  {
    step: 3,
    delayHours: 48,
    subject: 'Connect WhatsApp to never miss a message',
    headline: 'Connect WhatsApp',
    body: 'Most of your clients already use WhatsApp. Connect it to Booking OS and manage all conversations from one inbox — no more switching between apps.',
    ctaLabel: 'Connect WhatsApp',
    ctaPath: '/settings/notifications',
  },
  {
    step: 4,
    delayHours: 72,
    subject: 'Let AI handle your routine replies',
    headline: 'Turn on AI auto-replies',
    body: 'Booking OS can automatically detect customer intent — booking requests, cancellations, general questions — and reply instantly. Your clients get faster responses, and you save hours every week.',
    ctaLabel: 'Configure AI',
    ctaPath: '/settings/ai',
  },
  {
    step: 5,
    delayHours: 96,
    subject: 'Add your team members',
    headline: 'Invite your staff',
    body: 'If you have a team, invite them now. Each staff member gets their own calendar, can manage their appointments, and see only what they need. Assign roles to control access.',
    ctaLabel: 'Add Staff',
    ctaPath: '/staff',
  },
  {
    step: 6,
    delayHours: 144, // Day 6
    subject: 'Set up automatic booking reminders',
    headline: 'Reduce no-shows with reminders',
    body: 'No-shows cost clinics thousands per year. Booking OS sends automatic reminders via email before each appointment. Set it up once, and it runs forever.',
    ctaLabel: 'Set Up Reminders',
    ctaPath: '/settings/notifications',
  },
  {
    step: 7,
    delayHours: 192, // Day 8
    subject: 'Your first week in review',
    headline: "Here's how your first week went",
    body: "You've been on Booking OS for a week now. Check your dashboard to see how many bookings you've received, your busiest times, and where your clients are coming from.",
    ctaLabel: 'View Dashboard',
    ctaPath: '/dashboard',
  },
  {
    step: 8,
    delayHours: 216, // Day 9
    subject: 'Create message templates to save time',
    headline: 'Templates for faster replies',
    body: 'Stop typing the same messages over and over. Create templates for your most common replies — booking confirmations, follow-ups, aftercare instructions — and send them in one click.',
    ctaLabel: 'Create Templates',
    ctaPath: '/settings/templates',
  },
  {
    step: 9,
    delayHours: 240, // Day 10
    subject: 'Try campaigns: reach all your clients at once',
    headline: 'Send your first campaign',
    body: 'Have a promotion, a new service, or seasonal availability? Campaigns let you message your entire client base (or a filtered segment) in one go. Great for filling slow days.',
    ctaLabel: 'Create Campaign',
    ctaPath: '/campaigns/new',
  },
  {
    step: 10,
    delayHours: 264, // Day 11
    subject: '5 background AI agents working for you',
    headline: 'Meet your AI agents',
    body: 'While you focus on clients, 5 AI agents work behind the scenes: matching waitlist entries, detecting at-risk customers, cleaning up data, optimizing your schedule, and following up on quotes.',
    ctaLabel: 'View AI Agents',
    ctaPath: '/ai',
  },
  {
    step: 11,
    delayHours: 288, // Day 12
    subject: "Your trial ends in 2 days — here's what you'll keep",
    headline: 'Trial ending soon',
    body: 'Your 14-day free trial ends in 2 days. All your data, settings, templates, and client history will be preserved when you subscribe. Choose a plan to continue without interruption.',
    ctaLabel: 'Choose a Plan',
    ctaPath: '/settings/billing',
  },
  {
    step: 12,
    delayHours: 312, // Day 13
    subject: "Last day of your trial — don't lose your setup",
    headline: 'Final day',
    body: "Tomorrow your trial ends and your account moves to read-only mode. Everything you've built — services, templates, client data, booking history — is saved. Subscribe now to keep it all running.",
    ctaLabel: 'Subscribe Now',
    ctaPath: '/settings/billing',
  },
  {
    step: 13,
    delayHours: 360, // Day 15 (1 day after trial ends, in grace period)
    subject: 'Your trial has ended — your data is safe for 7 more days',
    headline: 'Grace period active',
    body: "Your free trial has ended, but we've kept everything intact. You have 7 days of read-only access before your data is archived. Subscribe to any plan to pick up right where you left off.",
    ctaLabel: 'Choose a Plan',
    ctaPath: '/settings/billing',
  },
];

export interface DripJobData {
  businessId: string;
  email: string;
  name: string;
  step: number;
}

@Injectable()
export class OnboardingDripService {
  private readonly logger = new Logger(OnboardingDripService.name);
  private processing = false;

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    @Inject('QUEUE_AVAILABLE') private queueAvailable: boolean,
    @Optional()
    @InjectQueue(QUEUE_NAMES.ONBOARDING_DRIP)
    private dripQueue?: Queue,
  ) {}

  /**
   * Schedule the full drip sequence for a new signup.
   * Called from AuthService.signup().
   */
  async scheduleDrip(businessId: string, email: string, name: string): Promise<void> {
    if (this.queueAvailable && this.dripQueue) {
      // Queue each email as a delayed job
      for (const drip of DRIP_EMAILS) {
        const delayMs = drip.delayHours * 60 * 60 * 1000;
        await this.dripQueue.add(
          `drip-step-${drip.step}`,
          { businessId, email, name, step: drip.step } satisfies DripJobData,
          {
            delay: delayMs,
            jobId: `drip-${businessId}-step-${drip.step}`,
            removeOnComplete: true,
            removeOnFail: { count: 3 },
          },
        );
      }
      this.logger.log(`Scheduled 13 drip emails for business ${businessId}`);
    } else {
      this.logger.log(`No queue available — drip emails will be sent via cron fallback`);
    }
  }

  /**
   * Process a single drip step.
   * Called by the processor or cron fallback.
   */
  async sendDripEmail(data: DripJobData): Promise<void> {
    const { businessId, email, name, step } = data;

    // Verify business still exists and hasn't subscribed (skip drip if paid)
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { subscription: true },
    });

    if (!business) {
      this.logger.log(`Skipping drip step ${step} — business ${businessId} not found`);
      return;
    }

    // If business has an active subscription, stop the drip (they converted)
    if (business.subscription && business.subscription.status === 'active') {
      this.logger.log(`Skipping drip step ${step} — business ${businessId} already subscribed`);
      return;
    }

    const dripEmail = DRIP_EMAILS.find((d) => d.step === step);
    if (!dripEmail) return;

    const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');

    try {
      await this.emailService.sendGeneric(email, {
        subject: dripEmail.subject,
        headline: dripEmail.headline,
        body: dripEmail.body.replace('{{name}}', name),
        ctaLabel: dripEmail.ctaLabel,
        ctaUrl: dripEmail.ctaPath ? `${webUrl}${dripEmail.ctaPath}` : undefined,
      });
      this.logger.log(`Sent drip step ${step} to ${email} (business ${businessId})`);
    } catch (err) {
      this.logger.warn(`Failed to send drip step ${step} to ${email}: ${(err as Error).message}`);
    }
  }

  /**
   * Cron fallback: For deployments without Redis, check for due drip emails.
   * Runs every hour and checks business.createdAt to determine which emails are due.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processDueDripEmails(): Promise<void> {
    // Skip if BullMQ is handling drips
    if (this.queueAvailable && this.dripQueue) return;
    if (this.processing) return;

    this.processing = true;
    try {
      // Find businesses created in the last 16 days (covers full drip + grace)
      const sixteenDaysAgo = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000);

      const businesses = await this.prisma.business.findMany({
        where: {
          createdAt: { gte: sixteenDaysAgo },
        },
        include: {
          subscription: true,
          staff: { where: { role: 'ADMIN' }, take: 1 },
        },
      });

      for (const business of businesses) {
        // Skip if already subscribed
        if (business.subscription?.status === 'active') continue;

        const admin = business.staff[0];
        if (!admin) continue;

        const hoursSinceSignup = (Date.now() - business.createdAt.getTime()) / (1000 * 60 * 60);

        // Find the latest drip step that should have been sent
        for (const drip of DRIP_EMAILS) {
          if (hoursSinceSignup >= drip.delayHours && hoursSinceSignup < drip.delayHours + 1) {
            // This drip is due within this hour window
            await this.sendDripEmail({
              businessId: business.id,
              email: admin.email,
              name: admin.name,
              step: drip.step,
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(`Drip cron failed: ${(err as Error).message}`);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Cancel drip for a business (e.g., when they subscribe).
   */
  async cancelDrip(businessId: string): Promise<void> {
    if (!this.queueAvailable || !this.dripQueue) return;

    for (const drip of DRIP_EMAILS) {
      const jobId = `drip-${businessId}-step-${drip.step}`;
      try {
        const job = await this.dripQueue.getJob(jobId);
        if (job && (await job.isDelayed())) {
          await job.remove();
        }
      } catch {
        // Job may already be processed or removed
      }
    }
    this.logger.log(`Canceled drip for business ${businessId}`);
  }
}
