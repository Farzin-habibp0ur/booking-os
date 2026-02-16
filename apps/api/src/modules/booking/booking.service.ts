import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Optional, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { BusinessService } from '../business/business.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import { TokenService } from '../../common/token.service';
import { WaitlistService } from '../waitlist/waitlist.service';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private businessService: BusinessService,
    private calendarSyncService: CalendarSyncService,
    private tokenService: TokenService,
    private config: ConfigService,
    @Optional() @Inject(forwardRef(() => WaitlistService)) private waitlistService?: WaitlistService,
  ) {}

  async findAll(
    businessId: string,
    query: {
      status?: string;
      staffId?: string;
      customerId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.staffId) where.staffId = query.staffId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          customer: true,
          service: true,
          staff: true,
          recurringSeries: { select: { id: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(businessId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        service: true,
        staff: true,
        conversation: true,
        reminders: true,
        recurringSeries: { select: { id: true } },
      },
    });
  }

  async create(
    businessId: string,
    data: {
      customerId: string;
      serviceId: string;
      staffId?: string;
      conversationId?: string;
      startTime: string;
      notes?: string;
      customFields?: any;
    },
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, businessId },
    });
    if (!service) throw new BadRequestException('Service not found');

    const startTime = new Date(data.startTime);
    const endTime = new Date(startTime.getTime() + service.durationMins * 60000);

    // Conflict detection
    if (data.staffId) {
      const conflict = await this.prisma.booking.findFirst({
        where: {
          businessId,
          staffId: data.staffId,
          status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflict) throw new BadRequestException('Staff has a conflicting booking at this time');
    }

    const isDepositRequired = service.depositRequired === true;

    const booking = await this.prisma.booking.create({
      data: {
        businessId,
        customerId: data.customerId,
        serviceId: data.serviceId,
        staffId: data.staffId,
        conversationId: data.conversationId,
        startTime,
        endTime,
        notes: data.notes,
        customFields: data.customFields || {},
        status: isDepositRequired ? 'PENDING_DEPOSIT' : 'CONFIRMED',
      },
      include: { customer: true, service: true, staff: true },
    });

    // Auto-create 24h reminder
    const reminderTime = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
    if (reminderTime > new Date()) {
      await this.prisma.reminder.create({
        data: {
          businessId,
          bookingId: booking.id,
          scheduledAt: reminderTime,
          status: 'PENDING',
        },
      });
    }

    // Fire-and-forget notification
    if (isDepositRequired) {
      this.notificationService.sendDepositRequest(booking).catch(() => {});
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { customFields: { depositRequestLog: [{ sentAt: new Date().toISOString() }] } },
      });
    } else {
      this.notificationService.sendBookingConfirmation(booking).catch(() => {});
    }

    // Fire-and-forget calendar sync
    this.calendarSyncService.syncBookingToCalendar(booking, 'create').catch(() => {});

    return booking;
  }

  async update(businessId: string, id: string, data: any) {
    if (data.startTime) {
      const booking = await this.prisma.booking.findFirst({
        where: { id, businessId },
        include: { service: true },
      });
      if (booking) {
        data.startTime = new Date(data.startTime);
        data.endTime = new Date(data.startTime.getTime() + booking.service.durationMins * 60000);
      }
    }
    const result = await this.prisma.booking.update({
      where: { id, businessId },
      data,
      include: { customer: true, service: true, staff: true },
    });

    // Fire-and-forget calendar sync
    this.calendarSyncService.syncBookingToCalendar(result, 'update').catch(() => {});

    return result;
  }

  async checkPolicyAllowed(
    businessId: string,
    bookingId: string,
    action: 'cancel' | 'reschedule',
  ): Promise<{ allowed: boolean; reason?: string; policyText?: string; hoursRemaining?: number; adminCanOverride?: boolean }> {
    const policySettings = await this.businessService.getPolicySettings(businessId);
    if (!policySettings || !policySettings.policyEnabled) {
      return { allowed: true };
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      select: { startTime: true },
    });
    if (!booking) return { allowed: true };

    const windowHours =
      action === 'cancel'
        ? policySettings.cancellationWindowHours
        : policySettings.rescheduleWindowHours;
    const policyText =
      action === 'cancel'
        ? policySettings.cancellationPolicyText
        : policySettings.reschedulePolicyText;

    const hoursUntilStart =
      (new Date(booking.startTime).getTime() - Date.now()) / 3600000;

    if (hoursUntilStart < windowHours) {
      return {
        allowed: false,
        reason: `Cannot ${action} within ${windowHours} hours of the appointment`,
        policyText: policyText || undefined,
        hoursRemaining: Math.max(0, Math.round(hoursUntilStart * 10) / 10),
        adminCanOverride: true,
      };
    }

    return { allowed: true, policyText: policyText || undefined };
  }

  async updateStatus(
    businessId: string,
    id: string,
    status: string,
    actor?: { reason?: string; staffId?: string; staffName?: string; role?: string },
  ) {
    // Read current booking to detect PENDING_DEPOSIT → CONFIRMED transition
    const currentBooking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      select: { status: true, startTime: true, customFields: true },
    });

    const overrideEntries: Array<{
      type: string;
      action: string;
      reason: string;
      staffId: string;
      staffName: string;
      timestamp: string;
    }> = [];

    // Deposit override: PENDING_DEPOSIT → CONFIRMED
    if (status === 'CONFIRMED' && currentBooking?.status === 'PENDING_DEPOSIT') {
      if (actor?.role !== 'ADMIN') {
        throw new ForbiddenException('Only admins can confirm a booking without deposit');
      }
      if (!actor?.reason) {
        throw new BadRequestException('A reason is required to override the deposit requirement');
      }
      overrideEntries.push({
        type: 'DEPOSIT_OVERRIDE',
        action: 'CONFIRMED',
        reason: actor.reason,
        staffId: actor.staffId || '',
        staffName: actor.staffName || '',
        timestamp: new Date().toISOString(),
      });
    }

    // Policy enforcement for cancellations
    if (status === 'CANCELLED' && currentBooking?.startTime) {
      const policySettings = await this.businessService.getPolicySettings(businessId);
      if (policySettings?.policyEnabled) {
        const hoursUntilStart =
          (new Date(currentBooking.startTime).getTime() - Date.now()) / 3600000;
        if (hoursUntilStart < policySettings.cancellationWindowHours) {
          // ADMIN can override with a reason
          if (actor?.role === 'ADMIN') {
            if (!actor?.reason) {
              throw new BadRequestException('A reason is required to override the cancellation policy');
            }
            overrideEntries.push({
              type: 'POLICY_OVERRIDE',
              action: 'CANCELLED',
              reason: actor.reason,
              staffId: actor.staffId || '',
              staffName: actor.staffName || '',
              timestamp: new Date().toISOString(),
            });
          } else {
            throw new BadRequestException(
              policySettings.cancellationPolicyText ||
                `Cannot cancel within ${policySettings.cancellationWindowHours} hours of the appointment`,
            );
          }
        }
      }
    }

    // Build update data, including overrideLog if any overrides occurred
    const updateData: any = { status };
    if (overrideEntries.length > 0) {
      const existingFields = (currentBooking?.customFields as any) || {};
      const existingLog = Array.isArray(existingFields.overrideLog)
        ? existingFields.overrideLog
        : [];
      updateData.customFields = {
        ...existingFields,
        overrideLog: [...existingLog, ...overrideEntries],
      };
    }

    const booking = await this.prisma.booking.update({
      where: { id, businessId },
      data: updateData,
      include: { customer: true, service: true, staff: true },
    });

    // Send booking confirmation when deposit is confirmed
    if (status === 'CONFIRMED' && currentBooking?.status === 'PENDING_DEPOSIT') {
      this.notificationService.sendBookingConfirmation(booking).catch(() => {});
    }

    // Cancel pending reminders if booking is cancelled/no-show
    if (['CANCELLED', 'NO_SHOW'].includes(status)) {
      await this.prisma.reminder.updateMany({
        where: { bookingId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      // Fire-and-forget calendar sync — remove event
      this.calendarSyncService.syncBookingToCalendar(booking, 'cancel').catch(() => {});

      // Send cancellation notification
      if (status === 'CANCELLED') {
        this.notificationService.sendCancellationNotification(booking).catch(() => {});
        // Offer open slot to waitlisted customers
        if (this.waitlistService) {
          this.waitlistService.offerOpenSlot(booking).catch(() => {});
        }
      }
    }

    // Create follow-up reminder when booking is completed
    if (status === 'COMPLETED') {
      const settings = await this.businessService.getNotificationSettings(businessId);
      const delayHours = settings?.followUpDelayHours || 2;
      await this.prisma.reminder.create({
        data: {
          businessId,
          bookingId: id,
          scheduledAt: new Date(Date.now() + delayHours * 3600000),
          status: 'PENDING',
          type: 'FOLLOW_UP',
        },
      });

      // Schedule consult follow-up for CONSULT bookings
      if (booking.service?.kind === 'CONSULT') {
        const delayDays = settings?.consultFollowUpDays || 3;
        await this.prisma.reminder.create({
          data: {
            businessId,
            bookingId: id,
            scheduledAt: new Date(Date.now() + delayDays * 24 * 3600000),
            status: 'PENDING',
            type: 'CONSULT_FOLLOW_UP',
          },
        });
      }

      // Schedule aftercare + treatment check-in for TREATMENT bookings
      if (booking.service?.kind === 'TREATMENT') {
        await this.prisma.reminder.create({
          data: {
            businessId,
            bookingId: id,
            scheduledAt: new Date(),
            status: 'PENDING',
            type: 'AFTERCARE',
          },
        });

        const checkInHours = settings?.treatmentCheckInHours || 24;
        await this.prisma.reminder.create({
          data: {
            businessId,
            bookingId: id,
            scheduledAt: new Date(Date.now() + checkInHours * 3600000),
            status: 'PENDING',
            type: 'TREATMENT_CHECK_IN',
          },
        });
      }
    }

    return booking;
  }

  async sendDepositRequest(businessId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      include: { customer: true, service: true, staff: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_DEPOSIT') {
      throw new BadRequestException('Booking is not in PENDING_DEPOSIT status');
    }

    await this.notificationService.sendDepositRequest(booking);

    const existingFields = (booking.customFields as any) || {};
    const log = Array.isArray(existingFields.depositRequestLog)
      ? existingFields.depositRequestLog
      : [];
    log.push({ sentAt: new Date().toISOString() });

    return this.prisma.booking.update({
      where: { id, businessId },
      data: { customFields: { ...existingFields, depositRequestLog: log } },
      include: { customer: true, service: true, staff: true },
    });
  }

  async sendRescheduleLink(businessId: string, id: string, actor: { staffId: string; staffName: string }) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      include: { customer: true, service: true, staff: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['CONFIRMED', 'PENDING_DEPOSIT'].includes(booking.status)) {
      throw new BadRequestException('Booking is not in a status that can be rescheduled');
    }

    // Revoke existing reschedule tokens for this booking
    await this.tokenService.revokeBookingTokens(booking.id, 'RESCHEDULE_LINK');

    // Create new token (48h expiry)
    const token = await this.tokenService.createToken(
      'RESCHEDULE_LINK',
      booking.customer.email || booking.customer.phone,
      businessId,
      undefined,
      48,
      booking.id,
    );

    const webUrl = this.config.get<string>('WEB_URL') || 'http://localhost:3000';
    const rescheduleLink = `${webUrl}/manage/reschedule/${token}`;

    // Send notification
    this.notificationService.sendRescheduleLink(booking, rescheduleLink).catch(() => {});

    // Append to selfServeLog
    const existingFields = (booking.customFields as any) || {};
    const selfServeLog = Array.isArray(existingFields.selfServeLog)
      ? existingFields.selfServeLog
      : [];
    selfServeLog.push({
      type: 'RESCHEDULE_LINK_SENT',
      sentAt: new Date().toISOString(),
      sentBy: actor.staffName,
      staffId: actor.staffId,
    });

    return this.prisma.booking.update({
      where: { id, businessId },
      data: { customFields: { ...existingFields, selfServeLog } },
      include: { customer: true, service: true, staff: true },
    });
  }

  async sendCancelLink(businessId: string, id: string, actor: { staffId: string; staffName: string }) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      include: { customer: true, service: true, staff: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['CONFIRMED', 'PENDING_DEPOSIT'].includes(booking.status)) {
      throw new BadRequestException('Booking is not in a status that can be cancelled');
    }

    // Revoke existing cancel tokens for this booking
    await this.tokenService.revokeBookingTokens(booking.id, 'CANCEL_LINK');

    // Create new token (48h expiry)
    const token = await this.tokenService.createToken(
      'CANCEL_LINK',
      booking.customer.email || booking.customer.phone,
      businessId,
      undefined,
      48,
      booking.id,
    );

    const webUrl = this.config.get<string>('WEB_URL') || 'http://localhost:3000';
    const cancelLink = `${webUrl}/manage/cancel/${token}`;

    // Send notification
    this.notificationService.sendCancelLink(booking, cancelLink).catch(() => {});

    // Append to selfServeLog
    const existingFields = (booking.customFields as any) || {};
    const selfServeLog = Array.isArray(existingFields.selfServeLog)
      ? existingFields.selfServeLog
      : [];
    selfServeLog.push({
      type: 'CANCEL_LINK_SENT',
      sentAt: new Date().toISOString(),
      sentBy: actor.staffName,
      staffId: actor.staffId,
    });

    return this.prisma.booking.update({
      where: { id, businessId },
      data: { customFields: { ...existingFields, selfServeLog } },
      include: { customer: true, service: true, staff: true },
    });
  }

  async getCalendar(businessId: string, dateFrom: string, dateTo: string, staffId?: string) {
    const where: any = {
      businessId,
      status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
      startTime: { gte: new Date(dateFrom) },
      endTime: { lte: new Date(dateTo) },
    };
    if (staffId) where.staffId = staffId;

    return this.prisma.booking.findMany({
      where,
      include: {
        customer: true,
        service: true,
        staff: true,
        recurringSeries: { select: { id: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }
}
