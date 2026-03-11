import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TreatmentPlanService {
  private readonly logger = new Logger(TreatmentPlanService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {}

  async create(
    businessId: string,
    staffId: string,
    data: {
      consultBookingId: string;
      diagnosis?: string;
      goals?: string;
      contraindications?: string;
      totalEstimate?: number;
      currency?: string;
      notes?: string;
      sessions?: Array<{
        serviceId: string;
        sequenceOrder: number;
        scheduledDate?: string;
        notes?: string;
      }>;
    },
  ) {
    // Validate consult booking
    const booking = await this.prisma.booking.findFirst({
      where: { id: data.consultBookingId, businessId },
      include: { service: true, customer: true, business: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.service.kind !== 'CONSULT') {
      throw new BadRequestException('Booking must be a consultation');
    }

    // Check business is aesthetic vertical
    if (booking.business.verticalPack !== 'aesthetic') {
      throw new BadRequestException('Treatment plans are only available for aesthetic clinics');
    }

    // Check no existing plan for this consultation
    const existing = await this.prisma.treatmentPlan.findUnique({
      where: { consultBookingId: data.consultBookingId },
    });
    if (existing) {
      throw new BadRequestException('A treatment plan already exists for this consultation');
    }

    // Validate session services if provided
    if (data.sessions?.length) {
      const serviceIds = data.sessions.map((s) => s.serviceId);
      const services = await this.prisma.service.findMany({
        where: { id: { in: serviceIds }, businessId },
      });
      if (services.length !== serviceIds.length) {
        throw new BadRequestException('One or more session services not found');
      }
    }

    const plan = await this.prisma.treatmentPlan.create({
      data: {
        businessId,
        customerId: booking.customerId,
        consultBookingId: data.consultBookingId,
        createdById: staffId,
        diagnosis: data.diagnosis,
        goals: data.goals,
        contraindications: data.contraindications,
        totalEstimate: data.totalEstimate,
        currency: data.currency || 'USD',
        notes: data.notes,
        sessions: data.sessions?.length
          ? {
              create: data.sessions.map((s) => ({
                serviceId: s.serviceId,
                sequenceOrder: s.sequenceOrder,
                scheduledDate: s.scheduledDate ? new Date(s.scheduledDate) : null,
                notes: s.notes,
              })),
            }
          : undefined,
      },
      include: {
        sessions: { include: { service: true }, orderBy: { sequenceOrder: 'asc' } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        consultBooking: { include: { service: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Treatment plan created: plan=${plan.id} consult=${data.consultBookingId}`);

    return plan;
  }

  async findAll(businessId: string, customerId?: string) {
    const where: any = { businessId };
    if (customerId) where.customerId = customerId;

    return this.prisma.treatmentPlan.findMany({
      where,
      include: {
        sessions: { include: { service: true }, orderBy: { sequenceOrder: 'asc' } },
        customer: { select: { id: true, name: true, phone: true } },
        consultBooking: { include: { service: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, businessId },
      include: {
        sessions: {
          include: {
            service: true,
            booking: { select: { id: true, status: true, startTime: true } },
          },
          orderBy: { sequenceOrder: 'asc' },
        },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        consultBooking: { include: { service: true, staff: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!plan) throw new NotFoundException('Treatment plan not found');
    return plan;
  }

  async update(
    businessId: string,
    id: string,
    data: {
      diagnosis?: string;
      goals?: string;
      contraindications?: string;
      totalEstimate?: number;
      notes?: string;
      status?: string;
    },
  ) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, businessId },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    if (data.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PROPOSED', 'CANCELLED'],
        PROPOSED: ['ACCEPTED', 'CANCELLED', 'DRAFT'],
        ACCEPTED: ['IN_PROGRESS', 'CANCELLED'],
        IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      };
      const allowed = validTransitions[plan.status] || [];
      if (!allowed.includes(data.status)) {
        throw new BadRequestException(
          `Cannot transition from ${plan.status} to ${data.status}`,
        );
      }
    }

    return this.prisma.treatmentPlan.update({
      where: { id },
      data: {
        ...(data.diagnosis !== undefined && { diagnosis: data.diagnosis }),
        ...(data.goals !== undefined && { goals: data.goals }),
        ...(data.contraindications !== undefined && { contraindications: data.contraindications }),
        ...(data.totalEstimate !== undefined && { totalEstimate: data.totalEstimate }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: {
        sessions: { include: { service: true }, orderBy: { sequenceOrder: 'asc' } },
        customer: { select: { id: true, name: true } },
      },
    });
  }

  async addSession(
    businessId: string,
    planId: string,
    data: { serviceId: string; sequenceOrder: number; scheduledDate?: string; notes?: string },
  ) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, businessId },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    if (plan.status !== 'DRAFT' && plan.status !== 'ACCEPTED' && plan.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Cannot add sessions in current plan status');
    }

    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, businessId },
    });
    if (!service) throw new NotFoundException('Service not found');

    return this.prisma.treatmentSession.create({
      data: {
        treatmentPlanId: planId,
        serviceId: data.serviceId,
        sequenceOrder: data.sequenceOrder,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
        notes: data.notes,
      },
      include: { service: true },
    });
  }

  async updateSession(
    businessId: string,
    planId: string,
    sessionId: string,
    data: { status?: string; scheduledDate?: string; bookingId?: string; notes?: string },
  ) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, businessId },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    const session = await this.prisma.treatmentSession.findFirst({
      where: { id: sessionId, treatmentPlanId: planId },
    });
    if (!session) throw new NotFoundException('Session not found');

    const updateData: any = {};
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.scheduledDate !== undefined) {
      updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
    }
    if (data.bookingId !== undefined) {
      updateData.bookingId = data.bookingId || null;
      if (data.bookingId) updateData.status = 'SCHEDULED';
    }
    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    const updated = await this.prisma.treatmentSession.update({
      where: { id: sessionId },
      data: updateData,
      include: { service: true, booking: { select: { id: true, status: true, startTime: true } } },
    });

    // Check if all sessions complete → mark plan COMPLETED
    if (data.status === 'COMPLETED') {
      await this.checkPlanCompletion(planId);
    }

    return updated;
  }

  async propose(businessId: string, planId: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, businessId },
      include: {
        sessions: { include: { service: true } },
        customer: true,
        business: true,
      },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('Only draft plans can be proposed');
    }

    if (plan.sessions.length === 0) {
      throw new BadRequestException('Plan must have at least one session');
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id: planId },
      data: { status: 'PROPOSED', proposedAt: new Date() },
      include: {
        sessions: { include: { service: true }, orderBy: { sequenceOrder: 'asc' } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    // Send notification to customer
    const webUrl = this.configService.get('WEB_URL', 'http://localhost:3000');
    const planLink = `${webUrl}/portal/${plan.business.slug}/dashboard`;

    this.notificationService
      .sendTreatmentPlanProposal(
        plan.customer,
        plan.business,
        plan.sessions.length,
        planLink,
      )
      .catch((err) =>
        this.logger.warn(`Failed to send treatment plan notification: ${err.message}`),
      );

    this.logger.log(`Treatment plan proposed: plan=${planId}`);
    return updated;
  }

  async accept(businessId: string, planId: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, businessId },
      include: { sessions: { include: { service: true }, orderBy: { sequenceOrder: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    if (plan.status !== 'PROPOSED') {
      throw new BadRequestException('Only proposed plans can be accepted');
    }

    const updated = await this.prisma.treatmentPlan.update({
      where: { id: planId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        sessions: { include: { service: true }, orderBy: { sequenceOrder: 'asc' } },
        customer: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Treatment plan accepted: plan=${planId}`);
    return updated;
  }

  async onBookingCompleted(bookingId: string) {
    // Check if this booking is linked to a treatment session
    const session = await this.prisma.treatmentSession.findUnique({
      where: { bookingId },
    });
    if (!session) return;

    await this.prisma.treatmentSession.update({
      where: { id: session.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await this.checkPlanCompletion(session.treatmentPlanId);
  }

  private async checkPlanCompletion(planId: string) {
    const sessions = await this.prisma.treatmentSession.findMany({
      where: { treatmentPlanId: planId },
    });

    const allDone = sessions.every(
      (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED',
    );

    if (allDone && sessions.length > 0) {
      await this.prisma.treatmentPlan.update({
        where: { id: planId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      this.logger.log(`Treatment plan completed: plan=${planId}`);
    } else {
      // Ensure plan is IN_PROGRESS if at least one session is done
      const plan = await this.prisma.treatmentPlan.findUnique({ where: { id: planId } });
      if (plan && plan.status === 'ACCEPTED') {
        await this.prisma.treatmentPlan.update({
          where: { id: planId },
          data: { status: 'IN_PROGRESS' },
        });
      }
    }
  }
}
