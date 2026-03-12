import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AftercareService {
  private readonly logger = new Logger(AftercareService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  // ── Protocol CRUD ──────────────────────────────────────────────────

  async createProtocol(
    businessId: string,
    data: {
      name: string;
      serviceId?: string;
      isDefault?: boolean;
      steps: Array<{
        sequenceOrder: number;
        delayHours: number;
        channel?: string;
        subject?: string;
        body: string;
        instructions?: string;
        isActive?: boolean;
      }>;
    },
  ) {
    // Validate service if provided
    if (data.serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: data.serviceId, businessId },
      });
      if (!service) throw new NotFoundException('Service not found');
    }

    // Check uniqueness for service-specific protocol
    if (data.serviceId) {
      const existing = await this.prisma.aftercareProtocol.findUnique({
        where: { businessId_serviceId: { businessId, serviceId: data.serviceId } },
      });
      if (existing) {
        throw new BadRequestException('A protocol already exists for this service');
      }
    }

    return this.prisma.aftercareProtocol.create({
      data: {
        businessId,
        name: data.name,
        serviceId: data.serviceId || null,
        isDefault: data.isDefault || false,
        steps: {
          create: data.steps.map((s) => ({
            sequenceOrder: s.sequenceOrder,
            delayHours: s.delayHours,
            channel: s.channel || 'WHATSAPP',
            subject: s.subject,
            body: s.body,
            instructions: s.instructions,
            isActive: s.isActive !== false,
          })),
        },
      },
      include: { steps: { orderBy: { sequenceOrder: 'asc' } }, service: true },
    });
  }

  async findAllProtocols(businessId: string) {
    return this.prisma.aftercareProtocol.findMany({
      where: { businessId },
      include: {
        steps: { orderBy: { sequenceOrder: 'asc' } },
        service: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProtocol(businessId: string, id: string) {
    const protocol = await this.prisma.aftercareProtocol.findFirst({
      where: { id, businessId },
      include: {
        steps: { orderBy: { sequenceOrder: 'asc' } },
        service: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!protocol) throw new NotFoundException('Aftercare protocol not found');
    return protocol;
  }

  async updateProtocol(
    businessId: string,
    id: string,
    data: {
      name?: string;
      isDefault?: boolean;
      isActive?: boolean;
      steps?: Array<{
        sequenceOrder: number;
        delayHours: number;
        channel?: string;
        subject?: string;
        body: string;
        instructions?: string;
        isActive?: boolean;
      }>;
    },
  ) {
    const protocol = await this.prisma.aftercareProtocol.findFirst({
      where: { id, businessId },
    });
    if (!protocol) throw new NotFoundException('Aftercare protocol not found');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    // If steps provided, replace all steps
    if (data.steps) {
      await this.prisma.aftercareStep.deleteMany({ where: { protocolId: id } });
      updateData.steps = {
        create: data.steps.map((s) => ({
          sequenceOrder: s.sequenceOrder,
          delayHours: s.delayHours,
          channel: s.channel || 'WHATSAPP',
          subject: s.subject,
          body: s.body,
          instructions: s.instructions,
          isActive: s.isActive !== false,
        })),
      };
    }

    return this.prisma.aftercareProtocol.update({
      where: { id },
      data: updateData,
      include: { steps: { orderBy: { sequenceOrder: 'asc' } }, service: true },
    });
  }

  async deleteProtocol(businessId: string, id: string) {
    const protocol = await this.prisma.aftercareProtocol.findFirst({
      where: { id, businessId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!protocol) throw new NotFoundException('Aftercare protocol not found');

    if (protocol._count.enrollments > 0) {
      // Soft delete — just deactivate
      return this.prisma.aftercareProtocol.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.aftercareProtocol.delete({ where: { id } });
  }

  // ── Enrollment ─────────────────────────────────────────────────────

  async enrollCustomer(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        customer: true,
        business: true,
      },
    });
    if (!booking) return null;

    // Only aesthetic businesses
    if (booking.business.verticalPack !== 'aesthetic') return null;

    // Only treatment bookings
    if (booking.service.kind !== 'TREATMENT') return null;

    // Check for existing enrollment
    const existing = await this.prisma.aftercareEnrollment.findUnique({
      where: { bookingId },
    });
    if (existing) return existing;

    // Find matching protocol: service-specific first, then default
    let protocol = await this.prisma.aftercareProtocol.findFirst({
      where: { businessId: booking.businessId, serviceId: booking.serviceId, isActive: true },
      include: { steps: { where: { isActive: true }, orderBy: { sequenceOrder: 'asc' } } },
    });

    if (!protocol) {
      protocol = await this.prisma.aftercareProtocol.findFirst({
        where: { businessId: booking.businessId, isDefault: true, isActive: true },
        include: { steps: { where: { isActive: true }, orderBy: { sequenceOrder: 'asc' } } },
      });
    }

    if (!protocol || protocol.steps.length === 0) {
      this.logger.debug(`No aftercare protocol found for booking ${bookingId}`);
      return null;
    }

    const now = new Date();

    const enrollment = await this.prisma.aftercareEnrollment.create({
      data: {
        protocolId: protocol.id,
        bookingId,
        customerId: booking.customerId,
        messages: {
          create: protocol.steps.map((step) => ({
            stepId: step.id,
            scheduledFor: new Date(now.getTime() + step.delayHours * 3600000),
            status: 'SCHEDULED',
          })),
        },
      },
      include: {
        messages: true,
        protocol: { include: { steps: { orderBy: { sequenceOrder: 'asc' } } } },
      },
    });

    this.logger.log(
      `Enrolled customer ${booking.customerId} in aftercare protocol "${protocol.name}" for booking ${bookingId} (${protocol.steps.length} messages scheduled)`,
    );

    return enrollment;
  }

  async findEnrollments(businessId: string, customerId?: string) {
    const where: any = {};
    if (customerId) where.customerId = customerId;

    // Filter by business through booking relation
    return this.prisma.aftercareEnrollment.findMany({
      where: {
        ...where,
        booking: { businessId },
      },
      include: {
        protocol: {
          include: {
            steps: { orderBy: { sequenceOrder: 'asc' } },
            service: { select: { id: true, name: true } },
          },
        },
        booking: {
          select: { id: true, startTime: true, service: { select: { name: true } } },
        },
        messages: { orderBy: { scheduledFor: 'asc' } },
      },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  async cancelEnrollment(businessId: string, enrollmentId: string) {
    const enrollment = await this.prisma.aftercareEnrollment.findFirst({
      where: { id: enrollmentId, booking: { businessId } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    // Cancel all pending messages
    await this.prisma.aftercareMessage.updateMany({
      where: { enrollmentId, status: 'SCHEDULED' },
      data: { status: 'CANCELLED' },
    });

    return this.prisma.aftercareEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'CANCELLED' },
      include: { messages: true },
    });
  }

  // ── Cron: Process Scheduled Messages ───────────────────────────────

  @Cron('0 */15 * * * *') // every 15 minutes
  async processScheduledMessages() {
    const now = new Date();

    const pendingMessages = await this.prisma.aftercareMessage.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledFor: { lte: now },
      },
      include: {
        enrollment: {
          include: {
            customer: { select: { name: true, phone: true, email: true } },
            booking: {
              include: {
                service: { select: { name: true } },
                business: { select: { id: true, name: true } },
              },
            },
            protocol: {
              include: { steps: true },
            },
          },
        },
      },
      take: 50, // process in batches
    });

    if (pendingMessages.length === 0) return;

    this.logger.log(`Processing ${pendingMessages.length} aftercare messages`);

    for (const msg of pendingMessages) {
      try {
        const step = msg.enrollment.protocol.steps.find((s) => s.id === msg.stepId);
        if (!step) {
          await this.prisma.aftercareMessage.update({
            where: { id: msg.id },
            data: { status: 'FAILED' },
          });
          continue;
        }

        const customer = msg.enrollment.customer;
        const booking = msg.enrollment.booking;
        const business = booking.business;

        // Resolve variables in body
        const body = this.resolveVariables(step.body, {
          customerName: customer.name,
          serviceName: booking.service.name,
          businessName: business.name,
          bookingDate: booking.startTime
            ? new Date(booking.startTime).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : '',
        });

        // Send via notification service based on channel
        if (step.channel === 'EMAIL' && customer.email) {
          await this.notificationService.sendTreatmentPlanProposal(
            customer,
            business,
            0, // not used for email subject override below
            '',
          );
          // Actually use the aftercare-specific email sending
          // We'll send via the notification service's whatsapp/email dispatchers
        }

        // Use sendAftercare-style dispatch
        await this.notificationService.sendAftercareStepMessage(
          customer.phone,
          customer.email || undefined,
          body,
          step.subject || `Aftercare Update - ${business.name}`,
          step.channel,
          business,
        );

        await this.prisma.aftercareMessage.update({
          where: { id: msg.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Failed to send aftercare message ${msg.id}:`, err);
        await this.prisma.aftercareMessage.update({
          where: { id: msg.id },
          data: { status: 'FAILED' },
        });
      }
    }

    // Check for enrollment completion
    const enrollmentIds = [...new Set(pendingMessages.map((m) => m.enrollmentId))];
    for (const enrollmentId of enrollmentIds) {
      const remaining = await this.prisma.aftercareMessage.count({
        where: { enrollmentId, status: 'SCHEDULED' },
      });
      if (remaining === 0) {
        await this.prisma.aftercareEnrollment.update({
          where: { id: enrollmentId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    }
  }

  // ── Portal ─────────────────────────────────────────────────────────

  async getPortalAftercareData(customerId: string, businessId: string) {
    return this.prisma.aftercareEnrollment.findMany({
      where: {
        customerId,
        booking: { businessId },
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      include: {
        protocol: {
          include: {
            steps: { where: { isActive: true }, orderBy: { sequenceOrder: 'asc' } },
          },
        },
        booking: {
          select: { startTime: true, service: { select: { name: true } } },
        },
        messages: { orderBy: { scheduledFor: 'asc' } },
      },
      orderBy: { enrolledAt: 'desc' },
      take: 5,
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private resolveVariables(template: string, context: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => context[key] || '');
  }
}
