import {
  Injectable,
  Inject,
  Logger,
  Optional,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { CreateSequenceDto, UpdateSequenceDto, EnrollSequenceDto } from './dto';

export interface SequenceStep {
  step: number;
  delayHours: number;
  subject: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaPath?: string;
}

export interface SequenceJobData {
  enrollmentId: string;
  sequenceId: string;
  businessId: string;
  email: string;
  name: string;
  step: number;
}

export const DEFAULT_SEQUENCES = [
  {
    name: 'Welcome Series',
    type: 'WELCOME',
    triggerEvent: 'SIGNUP',
    stopOnEvent: 'SUBSCRIPTION_ACTIVE',
    steps: [
      {
        step: 1,
        delayHours: 0,
        subject: 'Welcome to Booking OS!',
        headline: 'Welcome aboard!',
        body: "Thanks for signing up. We're excited to help you manage your business more efficiently. Let's get you set up in under 5 minutes.",
        ctaLabel: 'Get Started',
        ctaPath: '/settings',
      },
      {
        step: 2,
        delayHours: 24,
        subject: 'Quick win: Add your first service',
        headline: 'Create your first service',
        body: 'The fastest way to see Booking OS in action is to create your first service. It takes under 2 minutes and unlocks your online booking page.',
        ctaLabel: 'Add a Service',
        ctaPath: '/services',
      },
      {
        step: 3,
        delayHours: 48,
        subject: 'Your booking page is ready',
        headline: 'Share your booking link',
        body: 'Your online booking page is live. Share it with clients so they can self-book appointments anytime.',
        ctaLabel: 'View Booking Page',
        ctaPath: '/settings',
      },
      {
        step: 4,
        delayHours: 96,
        subject: 'Connect your communication channels',
        headline: 'Connect WhatsApp & more',
        body: 'Manage all client conversations from one inbox. Connect WhatsApp, set up auto-replies, and never miss a message.',
        ctaLabel: 'Connect Channels',
        ctaPath: '/settings/notifications',
      },
      {
        step: 5,
        delayHours: 168,
        subject: 'Your first week recap',
        headline: 'How your first week went',
        body: "You've been on Booking OS for a week. Check your dashboard to see your progress and discover features you haven't tried yet.",
        ctaLabel: 'View Dashboard',
        ctaPath: '/dashboard',
      },
    ],
  },
  {
    name: 'Feature Education',
    type: 'FEATURE_EDUCATION',
    triggerEvent: 'ONBOARDING_COMPLETE',
    stopOnEvent: null,
    steps: [
      {
        step: 1,
        delayHours: 24,
        subject: 'Unlock AI-powered auto-replies',
        headline: 'Let AI handle routine messages',
        body: 'Booking OS can automatically detect customer intent and reply instantly. Your clients get faster responses, and you save hours every week.',
        ctaLabel: 'Configure AI',
        ctaPath: '/settings/ai',
      },
      {
        step: 2,
        delayHours: 72,
        subject: 'Send targeted campaigns',
        headline: 'Reach the right clients',
        body: 'Campaigns let you message your entire client base or a filtered segment. Great for promotions, announcements, and filling slow days.',
        ctaLabel: 'Create Campaign',
        ctaPath: '/campaigns/new',
      },
      {
        step: 3,
        delayHours: 168,
        subject: 'Set up automations',
        headline: 'Automate your workflows',
        body: 'Create rules that run automatically — send follow-ups, update statuses, notify staff. Set it up once and let it work for you.',
        ctaLabel: 'View Automations',
        ctaPath: '/automations',
      },
      {
        step: 4,
        delayHours: 336,
        subject: 'Deep dive into reports',
        headline: 'Understand your business',
        body: 'Reports show you revenue trends, booking patterns, staff performance, and client retention. Use data to make smarter decisions.',
        ctaLabel: 'View Reports',
        ctaPath: '/reports',
      },
    ],
  },
  {
    name: 'Social Proof',
    type: 'SOCIAL_PROOF',
    triggerEvent: 'TRIAL_DAY_5',
    stopOnEvent: 'SUBSCRIPTION_ACTIVE',
    steps: [
      {
        step: 1,
        delayHours: 0,
        subject: 'How clinics like yours save 10+ hours/week',
        headline: 'Real results from real businesses',
        body: "Businesses using Booking OS reduce admin time by 40% and cut no-shows by 60%. Here's how they do it.",
        ctaLabel: 'See Case Studies',
        ctaPath: '/blog',
      },
      {
        step: 2,
        delayHours: 48,
        subject: 'What our customers say',
        headline: "Don't just take our word for it",
        body: '"Booking OS transformed how we manage our clinic. The AI handles most client questions, and we\'ve doubled our online bookings." — Sarah, Clinic Owner',
        ctaLabel: 'Start Using AI',
        ctaPath: '/settings/ai',
      },
      {
        step: 3,
        delayHours: 120,
        subject: 'Join 500+ businesses on Booking OS',
        headline: "You're in good company",
        body: 'Hundreds of service businesses trust Booking OS to manage their operations. Choose a plan and join them today.',
        ctaLabel: 'Choose a Plan',
        ctaPath: '/settings/billing',
      },
    ],
  },
  {
    name: 'Trial Expiry',
    type: 'TRIAL_EXPIRY',
    triggerEvent: 'TRIAL_ENDING',
    stopOnEvent: 'SUBSCRIPTION_ACTIVE',
    steps: [
      {
        step: 1,
        delayHours: 0,
        subject: 'Your trial ends in 3 days',
        headline: 'Trial ending soon',
        body: 'Your 14-day free trial ends in 3 days. All your data, settings, and client history will be preserved when you subscribe.',
        ctaLabel: 'Choose a Plan',
        ctaPath: '/settings/billing',
      },
      {
        step: 2,
        delayHours: 48,
        subject: 'Last day of your trial',
        headline: 'Final day of your free trial',
        body: "Tomorrow your trial ends. Everything you've built is saved. Subscribe now to keep it all running without interruption.",
        ctaLabel: 'Subscribe Now',
        ctaPath: '/settings/billing',
      },
      {
        step: 3,
        delayHours: 96,
        subject: 'Your trial has ended — data saved for 7 days',
        headline: 'Grace period active',
        body: "Your free trial has ended, but we've kept everything intact. You have 7 days before your data is archived. Subscribe to pick up where you left off.",
        ctaLabel: 'Reactivate',
        ctaPath: '/settings/billing',
      },
    ],
  },
  {
    name: 'Win Back',
    type: 'WIN_BACK',
    triggerEvent: 'CHURN_DETECTED',
    stopOnEvent: 'SUBSCRIPTION_ACTIVE',
    steps: [
      {
        step: 1,
        delayHours: 24,
        subject: 'We noticed you left — can we help?',
        headline: 'We miss you!',
        body: "We noticed your subscription ended. If something wasn't working right, we'd love to hear about it and help fix it.",
        ctaLabel: 'Give Feedback',
        ctaPath: '/settings/billing',
      },
      {
        step: 2,
        delayHours: 168,
        subject: "What's new in Booking OS",
        headline: 'A lot has changed',
        body: "We've shipped new features since you left: AI marketing agents, content automation, advanced reports, and more. Come back and see what's new.",
        ctaLabel: "See What's New",
        ctaPath: '/',
      },
      {
        step: 3,
        delayHours: 336,
        subject: 'Special offer: 20% off for 3 months',
        headline: 'A special deal for you',
        body: 'We want to win you back. Use code COMEBACK20 for 20% off any plan for 3 months. Your data is still safe and waiting.',
        ctaLabel: 'Claim Offer',
        ctaPath: '/settings/billing',
      },
      {
        step: 4,
        delayHours: 720,
        subject: 'Final note from our team',
        headline: 'One last thing',
        body: "This is our final message. Your data will be archived soon. If you ever want to come back, we'll be here. No hard feelings.",
        ctaLabel: 'Reactivate',
        ctaPath: '/settings/billing',
      },
    ],
  },
  {
    name: 'Upgrade Nudge',
    type: 'UPGRADE',
    triggerEvent: 'PLAN_LIMIT_HIT',
    stopOnEvent: 'PLAN_UPGRADED',
    steps: [
      {
        step: 1,
        delayHours: 0,
        subject: "You've hit your plan limit",
        headline: 'Time to level up?',
        body: "You've reached the limits of your current plan. Upgrade to unlock more staff seats, services, AI features, and advanced reports.",
        ctaLabel: 'Compare Plans',
        ctaPath: '/settings/billing',
      },
      {
        step: 2,
        delayHours: 72,
        subject: "What you're missing on your current plan",
        headline: 'Unlock more features',
        body: 'Higher plans include AI auto-replies, marketing automation, custom reports, and priority support. See what fits your business.',
        ctaLabel: 'Upgrade Now',
        ctaPath: '/settings/billing',
      },
      {
        step: 3,
        delayHours: 168,
        subject: 'Businesses that upgrade see 2x growth',
        headline: 'Growth starts here',
        body: 'On average, businesses that upgrade see 2x more bookings within 30 days. Ready to grow?',
        ctaLabel: 'Upgrade',
        ctaPath: '/settings/billing',
      },
    ],
  },
  {
    name: 'Referral Follow-up',
    type: 'REFERRAL',
    triggerEvent: 'REFERRAL_CREATED',
    stopOnEvent: null,
    steps: [
      {
        step: 1,
        delayHours: 0,
        subject: 'Your referral link is ready!',
        headline: 'Start sharing and earning',
        body: 'Thanks for referring a friend! Share your unique referral link and earn rewards when they sign up and subscribe.',
        ctaLabel: 'Share Link',
        ctaPath: '/marketing/referrals',
      },
      {
        step: 2,
        delayHours: 72,
        subject: 'Reminder: Share your referral link',
        headline: "Don't forget to share",
        body: 'You have a referral link waiting. Each successful referral earns you a reward. The more you share, the more you earn.',
        ctaLabel: 'Share Now',
        ctaPath: '/marketing/referrals',
      },
    ],
  },
];

@Injectable()
export class EmailSequenceService {
  private readonly logger = new Logger(EmailSequenceService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    @Inject('QUEUE_AVAILABLE') private queueAvailable: boolean,
    @Optional()
    @InjectQueue(QUEUE_NAMES.ONBOARDING_DRIP)
    private dripQueue?: Queue,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────

  async createSequence(businessId: string, dto: CreateSequenceDto) {
    return this.prisma.emailSequence.create({
      data: {
        businessId,
        name: dto.name,
        type: dto.type,
        isActive: dto.isActive ?? true,
        steps: dto.steps,
        triggerEvent: dto.triggerEvent,
        stopOnEvent: dto.stopOnEvent,
        metadata: dto.metadata ?? {},
      },
    });
  }

  async findAll(businessId: string, query?: { type?: string; isActive?: string }) {
    const where: any = {
      OR: [{ businessId }, { businessId: null }],
    };
    if (query?.type) where.type = query.type;
    if (query?.isActive !== undefined) where.isActive = query.isActive === 'true';

    const sequences = await this.prisma.emailSequence.findMany({
      where,
      include: { _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return sequences;
  }

  async findOne(businessId: string, id: string) {
    const sequence = await this.prisma.emailSequence.findFirst({
      where: { id, OR: [{ businessId }, { businessId: null }] },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!sequence) throw new NotFoundException('Email sequence not found');
    return sequence;
  }

  async updateSequence(businessId: string, id: string, dto: UpdateSequenceDto) {
    await this.findOne(businessId, id);
    return this.prisma.emailSequence.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.steps !== undefined && { steps: dto.steps }),
        ...(dto.triggerEvent !== undefined && { triggerEvent: dto.triggerEvent }),
        ...(dto.stopOnEvent !== undefined && { stopOnEvent: dto.stopOnEvent }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
      },
    });
  }

  async deleteSequence(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.emailSequence.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getStats(businessId: string) {
    const [byType, byStatus, totalEnrolled] = await Promise.all([
      this.prisma.emailSequence.groupBy({
        by: ['type'],
        where: { OR: [{ businessId }, { businessId: null }] },
        _count: true,
      }),
      this.prisma.emailSequenceEnrollment.groupBy({
        by: ['status'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.emailSequenceEnrollment.count({ where: { businessId } }),
    ]);

    return {
      byType: byType.reduce(
        (acc: Record<string, number>, r: any) => ({ ...acc, [r.type]: r._count }),
        {},
      ),
      byStatus: byStatus.reduce(
        (acc: Record<string, number>, r: any) => ({ ...acc, [r.status]: r._count }),
        {},
      ),
      totalEnrolled,
    };
  }

  // ─── Enrollment ────────────────────────────────────────────────────────

  async enroll(businessId: string, sequenceId: string, dto: EnrollSequenceDto) {
    const sequence = await this.findOne(businessId, sequenceId);
    if (!sequence.isActive) {
      throw new BadRequestException('Cannot enroll in an inactive sequence');
    }

    const steps = sequence.steps as unknown as SequenceStep[];

    const enrollment = await this.prisma.emailSequenceEnrollment.create({
      data: {
        sequenceId,
        businessId,
        email: dto.email,
        name: dto.name,
        metadata: dto.metadata ?? {},
      },
    });

    // Schedule BullMQ jobs for each step
    if (this.queueAvailable && this.dripQueue) {
      for (const step of steps) {
        const delayMs = step.delayHours * 60 * 60 * 1000;
        await this.dripQueue.add(
          `seq-step-${step.step}`,
          {
            enrollmentId: enrollment.id,
            sequenceId,
            businessId,
            email: dto.email,
            name: dto.name,
            step: step.step,
          } satisfies SequenceJobData,
          {
            delay: delayMs,
            jobId: `seq-${enrollment.id}-step-${step.step}`,
            removeOnComplete: true,
            removeOnFail: { count: 3 },
          },
        );
      }
      this.logger.log(`Scheduled ${steps.length} sequence steps for enrollment ${enrollment.id}`);
    }

    return enrollment;
  }

  async getEnrollments(businessId: string, sequenceId: string, query?: { status?: string }) {
    const where: any = { businessId, sequenceId };
    if (query?.status) where.status = query.status;

    return this.prisma.emailSequenceEnrollment.findMany({
      where,
      orderBy: { enrolledAt: 'desc' },
      take: 100,
    });
  }

  async cancelEnrollment(businessId: string, enrollmentId: string) {
    const enrollment = await this.prisma.emailSequenceEnrollment.findFirst({
      where: { id: enrollmentId, businessId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.status !== 'ACTIVE' && enrollment.status !== 'PAUSED') {
      throw new BadRequestException('Only active or paused enrollments can be cancelled');
    }

    await this.removeQueuedJobs(enrollment.id, enrollment.sequenceId);

    return this.prisma.emailSequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  async pauseEnrollment(businessId: string, enrollmentId: string) {
    const enrollment = await this.prisma.emailSequenceEnrollment.findFirst({
      where: { id: enrollmentId, businessId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.status !== 'ACTIVE') {
      throw new BadRequestException('Only active enrollments can be paused');
    }

    await this.removeQueuedJobs(enrollment.id, enrollment.sequenceId);

    return this.prisma.emailSequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'PAUSED' },
    });
  }

  async resumeEnrollment(businessId: string, enrollmentId: string) {
    const enrollment = await this.prisma.emailSequenceEnrollment.findFirst({
      where: { id: enrollmentId, businessId },
      include: { sequence: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.status !== 'PAUSED') {
      throw new BadRequestException('Only paused enrollments can be resumed');
    }

    const steps = enrollment.sequence.steps as unknown as SequenceStep[];
    const remainingSteps = steps.filter((s) => s.step > enrollment.currentStep);

    // Reschedule remaining steps
    if (this.queueAvailable && this.dripQueue) {
      for (const step of remainingSteps) {
        const delayMs = step.delayHours * 60 * 60 * 1000;
        await this.dripQueue.add(
          `seq-step-${step.step}`,
          {
            enrollmentId: enrollment.id,
            sequenceId: enrollment.sequenceId,
            businessId: enrollment.businessId,
            email: enrollment.email,
            name: enrollment.name,
            step: step.step,
          } satisfies SequenceJobData,
          {
            delay: delayMs,
            jobId: `seq-${enrollment.id}-step-${step.step}`,
            removeOnComplete: true,
            removeOnFail: { count: 3 },
          },
        );
      }
    }

    return this.prisma.emailSequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'ACTIVE' },
    });
  }

  // ─── Step Processing ───────────────────────────────────────────────────

  async processStep(enrollmentId: string, step: number): Promise<void> {
    const enrollment = await this.prisma.emailSequenceEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { sequence: true },
    });

    if (!enrollment) {
      this.logger.warn(`Enrollment ${enrollmentId} not found, skipping step ${step}`);
      return;
    }

    if (enrollment.status !== 'ACTIVE') {
      this.logger.log(`Enrollment ${enrollmentId} is ${enrollment.status}, skipping step ${step}`);
      return;
    }

    const steps = enrollment.sequence.steps as unknown as SequenceStep[];
    const stepDef = steps.find((s) => s.step === step);
    if (!stepDef) {
      this.logger.warn(`Step ${step} not found in sequence ${enrollment.sequenceId}`);
      return;
    }

    const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');

    try {
      await this.emailService.sendGeneric(enrollment.email, {
        subject: stepDef.subject,
        headline: stepDef.headline,
        body: stepDef.body.replace('{{name}}', enrollment.name),
        ctaLabel: stepDef.ctaLabel,
        ctaUrl: stepDef.ctaPath ? `${webUrl}${stepDef.ctaPath}` : undefined,
      });

      const isLastStep = step >= Math.max(...steps.map((s) => s.step));

      await this.prisma.emailSequenceEnrollment.update({
        where: { id: enrollmentId },
        data: {
          currentStep: step,
          ...(isLastStep && { status: 'COMPLETED', completedAt: new Date() }),
        },
      });

      this.logger.log(
        `Sent sequence step ${step} to ${enrollment.email} (enrollment ${enrollmentId})`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to send sequence step ${step} to ${enrollment.email}: ${(err as Error).message}`,
      );
    }
  }

  // ─── Trigger Events ────────────────────────────────────────────────────

  async handleTriggerEvent(
    businessId: string,
    event: string,
    payload: { email: string; name: string },
  ) {
    const sequences = await this.prisma.emailSequence.findMany({
      where: {
        triggerEvent: event,
        isActive: true,
        OR: [{ businessId }, { businessId: null }],
      },
    });

    for (const seq of sequences) {
      try {
        // Check for existing enrollment to prevent duplicates
        const existing = await this.prisma.emailSequenceEnrollment.findUnique({
          where: {
            sequenceId_businessId_email: {
              sequenceId: seq.id,
              businessId,
              email: payload.email,
            },
          },
        });

        if (!existing) {
          await this.enroll(businessId, seq.id, {
            email: payload.email,
            name: payload.name,
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-enroll for event ${event}: ${(err as Error).message}`);
      }
    }
  }

  async handleStopEvent(businessId: string, event: string) {
    const sequences = await this.prisma.emailSequence.findMany({
      where: {
        stopOnEvent: event,
        OR: [{ businessId }, { businessId: null }],
      },
    });

    for (const seq of sequences) {
      const enrollments = await this.prisma.emailSequenceEnrollment.findMany({
        where: { sequenceId: seq.id, businessId, status: 'ACTIVE' },
      });

      for (const enrollment of enrollments) {
        try {
          await this.cancelEnrollment(businessId, enrollment.id);
        } catch (err) {
          this.logger.warn(
            `Failed to cancel enrollment ${enrollment.id}: ${(err as Error).message}`,
          );
        }
      }
    }
  }

  // ─── Seed ──────────────────────────────────────────────────────────────

  async seedDefaultSequences(): Promise<number> {
    let created = 0;
    for (const seq of DEFAULT_SEQUENCES) {
      const existing = await this.prisma.emailSequence.findFirst({
        where: { type: seq.type, businessId: null },
      });
      if (!existing) {
        await this.prisma.emailSequence.create({
          data: {
            businessId: null,
            name: seq.name,
            type: seq.type,
            steps: seq.steps,
            triggerEvent: seq.triggerEvent,
            stopOnEvent: seq.stopOnEvent,
          },
        });
        created++;
      }
    }
    return created;
  }

  // ─── Upgrade Signal ──────────────────────────────────────────────────

  private static readonly RESOURCE_LIMITS: Record<string, Record<string, number>> = {
    starter: { bookings: 500, staff: 3, services: 10 },
    professional: { bookings: 5000, staff: 10, services: 50 },
    enterprise: { bookings: Infinity, staff: Infinity, services: Infinity },
  };

  @Cron(CronExpression.EVERY_WEEK)
  async checkUpgradeSignals(): Promise<void> {
    this.logger.log('Checking upgrade signals for all businesses...');

    const businesses = await this.prisma.business.findMany({
      where: {
        subscription: { status: 'active' },
      },
      include: {
        subscription: true,
        staff: { where: { isActive: true }, select: { id: true } },
        _count: { select: { bookings: true, services: true } },
      },
    });

    for (const biz of businesses) {
      try {
        const plan = (biz.subscription?.plan || 'starter').toLowerCase();
        const limits = EmailSequenceService.RESOURCE_LIMITS[plan];
        if (!limits) continue;

        const bookingCount = biz._count.bookings;
        const staffCount = biz.staff.length;
        const serviceCount = biz._count.services;

        const isNear =
          (limits.bookings !== Infinity && bookingCount >= limits.bookings * 0.8) ||
          (limits.staff !== Infinity && staffCount >= limits.staff * 0.8) ||
          (limits.services !== Infinity && serviceCount >= limits.services * 0.8);

        if (!isNear) continue;

        const admin = await this.prisma.staff.findFirst({
          where: { businessId: biz.id, role: 'ADMIN' },
          select: { email: true, name: true },
        });
        if (!admin?.email) continue;

        await this.handleTriggerEvent(biz.id, 'PLAN_LIMIT_HIT', {
          email: admin.email,
          name: admin.name,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to check upgrade signal for business ${biz.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  // ─── Metrics & Bottleneck ─────────────────────────────────────────────

  async getSequenceMetrics(businessId: string, sequenceId: string) {
    const sequence = await this.findOne(businessId, sequenceId);
    const steps = sequence.steps as unknown as SequenceStep[];

    const enrollments = await this.prisma.emailSequenceEnrollment.findMany({
      where: { sequenceId, businessId },
    });

    const totalEnrolled = enrollments.length;
    const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
    const active = enrollments.filter((e) => e.status === 'ACTIVE').length;
    const cancelled = enrollments.filter((e) => e.status === 'CANCELLED').length;

    const stepMetrics = steps.map((step) => {
      const reachedStep = enrollments.filter((e) => e.currentStep >= step.step).length;
      const passedStep =
        step.step < Math.max(...steps.map((s) => s.step))
          ? enrollments.filter((e) => e.currentStep > step.step).length
          : completed;
      const dropOff = reachedStep > 0 ? ((reachedStep - passedStep) / reachedStep) * 100 : 0;

      return {
        step: step.step,
        subject: step.subject,
        reached: reachedStep,
        passed: passedStep,
        dropOffRate: Math.round(dropOff * 100) / 100,
      };
    });

    const completionRate =
      totalEnrolled > 0 ? Math.round((completed / totalEnrolled) * 10000) / 100 : 0;

    return {
      sequenceId,
      totalEnrolled,
      active,
      completed,
      cancelled,
      completionRate,
      stepMetrics,
    };
  }

  async getBottleneck(businessId: string, sequenceId: string) {
    const metrics = await this.getSequenceMetrics(businessId, sequenceId);

    if (metrics.stepMetrics.length === 0) {
      return { bottleneck: null, metrics };
    }

    const bottleneck = metrics.stepMetrics.reduce((worst, current) =>
      current.dropOffRate > worst.dropOffRate ? current : worst,
    );

    return {
      bottleneck: bottleneck.dropOffRate > 0 ? bottleneck : null,
      metrics,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async removeQueuedJobs(enrollmentId: string, sequenceId: string) {
    if (!this.queueAvailable || !this.dripQueue) return;

    const sequence = await this.prisma.emailSequence.findUnique({
      where: { id: sequenceId },
    });
    if (!sequence) return;

    const steps = sequence.steps as unknown as SequenceStep[];
    for (const step of steps) {
      const jobId = `seq-${enrollmentId}-step-${step.step}`;
      try {
        const job = await this.dripQueue.getJob(jobId);
        if (job && (await job.isDelayed())) {
          await job.remove();
        }
      } catch {
        // Job may already be processed or removed
      }
    }
  }
}
