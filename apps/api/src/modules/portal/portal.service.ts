import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { BookingService } from '../booking/booking.service';
import { UpdatePortalProfileDto, CreatePortalBookingDto } from './dto';

@Injectable()
export class PortalService {
  constructor(
    private prisma: PrismaService,
    private bookingService: BookingService,
  ) {}

  async getProfile(customerId: string, businessId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const [totalBookings, totalSpent] = await Promise.all([
      this.prisma.booking.count({
        where: { customerId, businessId },
      }),
      this.prisma.booking.aggregate({
        where: { customerId, businessId, status: 'COMPLETED' },
        _sum: { amount: true },
      } as any),
    ]);

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      preferences: (customer as any).customFields || {},
      memberSince: customer.createdAt,
      totalBookings,
      totalSpent: (totalSpent as any)._sum?.amount || 0,
    };
  }

  async updateProfile(customerId: string, businessId: string, dto: UpdatePortalProfileDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (
      dto.notifyWhatsApp !== undefined ||
      dto.notifyEmail !== undefined ||
      dto.customFields !== undefined
    ) {
      const prefs = ((customer as any).customFields as any) || {};
      if (dto.notifyWhatsApp !== undefined) prefs.notifyWhatsApp = dto.notifyWhatsApp;
      if (dto.notifyEmail !== undefined) prefs.notifyEmail = dto.notifyEmail;
      if (dto.customFields !== undefined) {
        Object.assign(prefs, dto.customFields);
      }
      data.customFields = prefs;
    }

    return this.prisma.customer.update({
      where: { id: customerId },
      data,
    });
  }

  async getBookings(
    customerId: string,
    businessId: string,
    query: { page?: number; status?: string },
  ) {
    const page = query.page || 1;
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    const where: any = { customerId, businessId };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          service: { select: { name: true, durationMins: true, price: true } },
          staff: { select: { name: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getUpcoming(customerId: string, businessId: string) {
    return this.prisma.booking.findMany({
      where: {
        customerId,
        businessId,
        startTime: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        service: { select: { name: true, durationMins: true, price: true } },
        staff: { select: { name: true } },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    });
  }

  async cancelBooking(customerId: string, businessId: string, bookingId: string, reason?: string) {
    // Verify booking belongs to this customer AND business (tenant isolation)
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId, businessId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Check cancellable status
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new ConflictException(`Cannot cancel a booking with status ${booking.status}`);
    }

    // Check cancellation policy
    const policy = await this.bookingService.checkPolicyAllowed(businessId, bookingId, 'cancel');
    if (!policy.allowed) {
      throw new ForbiddenException(policy.reason || 'Cancellation not allowed');
    }

    return this.bookingService.updateStatus(businessId, bookingId, 'CANCELLED', {
      reason: reason || 'Cancelled by customer via portal',
    });
  }

  async rescheduleBooking(
    customerId: string,
    businessId: string,
    bookingId: string,
    newStartTime: string,
  ) {
    // Verify booking belongs to this customer AND business (tenant isolation)
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, customerId, businessId },
      include: { service: { select: { durationMins: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Check reschedulable status
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new ConflictException(`Cannot reschedule a booking with status ${booking.status}`);
    }

    // Check reschedule policy
    const policy = await this.bookingService.checkPolicyAllowed(
      businessId,
      bookingId,
      'reschedule',
    );
    if (!policy.allowed) {
      throw new ForbiddenException(policy.reason || 'Rescheduling not allowed');
    }

    const newStart = new Date(newStartTime);
    const durationMins = (booking as any).service?.durationMins || 30;
    const newEnd = new Date(newStart.getTime() + durationMins * 60000);

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        startTime: newStart,
        endTime: newEnd,
      },
      include: {
        service: { select: { name: true, durationMins: true, price: true } },
        staff: { select: { name: true } },
      },
    });
  }

  async getInvoices(customerId: string, businessId: string) {
    return this.prisma.invoice.findMany({
      where: { customerId, businessId, status: { not: 'DRAFT' } },
      orderBy: { createdAt: 'desc' },
      include: {
        lineItems: true,
      },
    });
  }

  async getServices(businessId: string) {
    return this.prisma.service.findMany({
      where: { businessId, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        durationMins: true,
        price: true,
        category: true,
        depositRequired: true,
        depositAmount: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createBooking(customerId: string, businessId: string, dto: CreatePortalBookingDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, businessId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found');

    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + service.durationMins * 60000);

    // If staffId provided, verify they belong to this business
    if (dto.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: dto.staffId, businessId, isActive: true },
      });
      if (!staff) throw new NotFoundException('Staff not found');
    }

    const booking = await this.prisma.booking.create({
      data: {
        businessId,
        customerId,
        serviceId: dto.serviceId,
        staffId: dto.staffId || null,
        startTime,
        endTime,
        status: 'PENDING',
        source: 'PORTAL',
        notes: dto.notes || null,
      },
      include: {
        service: { select: { name: true, price: true, durationMins: true } },
        staff: { select: { name: true } },
      },
    });

    return booking;
  }

  async getDocuments(customerId: string, businessId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, customFields: true },
    });

    // Get booking notes (completed bookings with notes)
    const bookingNotes = await this.prisma.booking.findMany({
      where: {
        customerId,
        businessId,
        status: 'COMPLETED',
        notes: { not: null },
      },
      select: {
        id: true,
        notes: true,
        startTime: true,
        service: { select: { name: true } },
        staff: { select: { name: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 20,
    });

    // Extract intake data from customFields
    const fields = (customer?.customFields as any) || {};
    const intakeData = fields.intakeComplete
      ? {
          submittedAt: fields.intakeSubmittedAt,
          fullName: fields.intakeFullName,
          dateOfBirth: fields.intakeDateOfBirth,
          emergencyContactName: fields.intakeEmergencyName,
          emergencyContactPhone: fields.intakeEmergencyPhone,
          medicalConditions: fields.intakeMedicalConditions,
          medications: fields.intakeMedications,
        }
      : null;

    return {
      intake: intakeData,
      bookingNotes: bookingNotes.map((b) => ({
        id: b.id,
        date: b.startTime,
        service: b.service.name,
        staff: b.staff?.name || null,
        notes: b.notes,
      })),
    };
  }

  async createInvoicePaymentSession(
    customerId: string,
    businessId: string,
    invoiceId: string,
    successUrl?: string,
    cancelUrl?: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        customerId,
        businessId,
        status: { in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      include: {
        lineItems: true,
        business: { select: { name: true } },
        customer: { select: { email: true } },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');

    const amountDue = Number(invoice.total) - Number(invoice.paidAmount);
    if (amountDue <= 0) throw new BadRequestException('Invoice is already paid');

    // Check if Stripe is configured
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) throw new BadRequestException('Online payments are not configured');

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: invoice.customer.email || undefined,
      line_items: [
        {
          price_data: {
            currency: (invoice.currency || 'usd').toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.invoiceNumber}`,
              description: invoice.lineItems.map((li: any) => li.description).join(', '),
            },
            unit_amount: Math.round(amountDue * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: invoice.id,
        businessId,
        customerId,
      },
      success_url:
        successUrl || `${process.env.WEB_URL || 'http://localhost:3000'}/portal/payment-success`,
      cancel_url:
        cancelUrl || `${process.env.WEB_URL || 'http://localhost:3000'}/portal/payment-cancelled`,
    });

    return { url: session.url, sessionId: session.id };
  }

  async getTreatmentPlans(customerId: string, businessId: string) {
    return this.prisma.treatmentPlan.findMany({
      where: { customerId, businessId },
      include: {
        sessions: {
          include: {
            service: { select: { id: true, name: true, durationMins: true, price: true } },
          },
          orderBy: { sequenceOrder: 'asc' },
        },
        consultBooking: {
          include: { service: { select: { name: true } } },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptTreatmentPlan(customerId: string, businessId: string, planId: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, customerId, businessId, status: 'PROPOSED' },
    });
    if (!plan)
      throw new NotFoundException('Treatment plan not found or not available for acceptance');

    return this.prisma.treatmentPlan.update({
      where: { id: planId },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
      include: {
        sessions: {
          include: { service: { select: { id: true, name: true } } },
          orderBy: { sequenceOrder: 'asc' },
        },
      },
    });
  }

  async getAftercare(customerId: string, businessId: string) {
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

  async getPackages(customerId: string, businessId: string) {
    return this.prisma.packagePurchase.findMany({
      where: {
        customerId,
        businessId,
        status: { in: ['ACTIVE', 'EXHAUSTED'] },
      },
      include: {
        package: {
          select: { id: true, name: true, serviceId: true, service: { select: { name: true } } },
        },
      },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  async getClassSchedule(businessId: string, week: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (!biz || biz.verticalPack !== 'wellness') return [];

    const classes = await this.prisma.recurringClass.findMany({
      where: { businessId, isActive: true },
      include: {
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
        resource: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    // Parse week and generate schedule with enrollment counts
    const match = week?.match(/^(\d{4})-W(\d{1,2})$/);
    if (!match) return classes;

    const year = parseInt(match[1]);
    const weekNum = parseInt(match[2]);
    const jan4 = new Date(year, 0, 4);
    const dow = jan4.getDay() || 7;
    const weekStart = new Date(jan4);
    weekStart.setDate(jan4.getDate() - dow + 1 + (weekNum - 1) * 7);

    return Promise.all(
      classes.map(async (cls) => {
        const classDate = new Date(weekStart);
        const offset = cls.dayOfWeek === 0 ? 6 : cls.dayOfWeek - 1;
        classDate.setDate(weekStart.getDate() + offset);

        const [h, m] = cls.startTime.split(':').map(Number);
        const classStart = new Date(classDate);
        classStart.setHours(h, m, 0, 0);

        const enrollmentCount = await this.prisma.booking.count({
          where: {
            businessId,
            serviceId: cls.serviceId,
            staffId: cls.staffId,
            startTime: classStart,
            status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
          },
        });

        return {
          ...cls,
          date: classDate.toISOString().split('T')[0],
          enrollmentCount,
          spotsRemaining: cls.maxParticipants - enrollmentCount,
        };
      }),
    );
  }

  async getPractitioners(businessId: string) {
    const staff = await this.prisma.staff.findMany({
      where: { businessId, isActive: true, role: { in: ['SERVICE_PROVIDER', 'ADMIN'] } },
      select: {
        id: true,
        name: true,
        staffServicePrices: {
          select: {
            service: { select: { id: true, name: true, category: true } },
          },
        },
        certifications: {
          select: {
            id: true,
            name: true,
            issuedBy: true,
            expiryDate: true,
            isVerified: true,
          },
        },
        workingHours: {
          select: { dayOfWeek: true, startTime: true, endTime: true, isOff: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    return staff.map((s) => ({
      id: s.id,
      name: s.name,
      specialties: s.staffServicePrices.map((ssp) => ssp.service),
      certifications: s.certifications.filter(
        (c) => !c.expiryDate || new Date(c.expiryDate) > new Date(),
      ),
      workingHours: s.workingHours,
    }));
  }
}
