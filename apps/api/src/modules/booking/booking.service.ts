import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { BusinessService } from '../business/business.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import { TokenService } from '../../common/token.service';
import { WaitlistService } from '../waitlist/waitlist.service';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private businessService: BusinessService,
    private calendarSyncService: CalendarSyncService,
    private tokenService: TokenService,
    private config: ConfigService,
    @Optional()
    @Inject(forwardRef(() => WaitlistService))
    private waitlistService?: WaitlistService,
  ) {}

  async findAll(
    businessId: string,
    query: {
      status?: string;
      staffId?: string;
      customerId?: string;
      locationId?: string;
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
    if (query.locationId) where.locationId = query.locationId;
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
      locationId?: string;
      resourceId?: string;
      forceBook?: boolean;
      forceBookReason?: string;
    },
    currentUser?: { staffId: string; staffName: string; role: string },
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, businessId },
    });
    if (!service) throw new BadRequestException('Service not found');

    const startTime = new Date(data.startTime);
    const endTime = new Date(startTime.getTime() + service.durationMins * 60000);

    const isDepositRequired = service.depositRequired === true;

    // Validate resource belongs to the specified location
    if (data.resourceId) {
      const resource = await this.prisma.resource.findFirst({
        where: { id: data.resourceId, isActive: true },
      });
      if (!resource) throw new BadRequestException('Resource not found');
      if (data.locationId && resource.locationId !== data.locationId) {
        throw new BadRequestException('Resource does not belong to the specified location');
      }
    }

    // Validate staff is assigned to the specified location
    if (data.locationId && data.staffId) {
      const assignment = await this.prisma.staffLocation.findUnique({
        where: { staffId_locationId: { staffId: data.staffId, locationId: data.locationId } },
      });
      if (!assignment) {
        throw new BadRequestException('Staff is not assigned to the specified location');
      }
    }

    // Build override log if forceBook is used
    const overrideLog =
      data.forceBook && currentUser
        ? {
            forceBooked: true,
            reason: data.forceBookReason || 'VIP override',
            adminId: currentUser.staffId,
            adminName: currentUser.staffName,
            timestamp: new Date().toISOString(),
          }
        : undefined;

    const mergedCustomFields = {
      ...(data.customFields || {}),
      ...(overrideLog ? { overrideLog } : {}),
    };

    // C1 fix: Wrap conflict check + create in transaction with row lock to prevent double-booking
    const booking = await this.prisma.$transaction(async (tx) => {
      if (!data.forceBook) {
        if (data.staffId) {
          // Lock staff row to serialize concurrent booking creation for same staff
          await tx.$queryRaw`SELECT id FROM "Staff" WHERE id = ${data.staffId} FOR UPDATE`;
          const conflict = await tx.booking.findFirst({
            where: {
              businessId,
              staffId: data.staffId,
              status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          });
          if (conflict)
            throw new BadRequestException('Staff has a conflicting booking at this time');
        }

        // Check resource conflict
        if (data.resourceId) {
          const resourceConflict = await tx.booking.findFirst({
            where: {
              businessId,
              resourceId: data.resourceId,
              status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          });
          if (resourceConflict) {
            throw new BadRequestException('Resource has a conflicting booking at this time');
          }
        }
      }

      return tx.booking.create({
        data: {
          businessId,
          customerId: data.customerId,
          serviceId: data.serviceId,
          staffId: data.staffId,
          conversationId: data.conversationId,
          locationId: data.locationId,
          resourceId: data.resourceId,
          startTime,
          endTime,
          notes: data.notes,
          customFields: mergedCustomFields,
          status: isDepositRequired ? 'PENDING_DEPOSIT' : 'CONFIRMED',
        },
        include: { customer: true, service: true, staff: true },
      });
    });

    // Post-creation side effects — must not fail the booking response
    try {
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
    } catch (err) {
      this.logger.error(`Failed to create reminder for booking ${booking.id}`, err);
    }

    // Fire-and-forget notification
    if (isDepositRequired) {
      this.notificationService.sendDepositRequest(booking).catch((err) =>
        this.logger.warn(`Failed to send deposit request for booking ${booking.id}`, {
          bookingId: booking.id,
          error: err.message,
        }),
      );
      try {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { customFields: { depositRequestLog: [{ sentAt: new Date().toISOString() }] } },
        });
      } catch (err) {
        this.logger.error(`Failed to log deposit request for booking ${booking.id}`, err);
      }
    } else {
      this.notificationService.sendBookingConfirmation(booking).catch((err) =>
        this.logger.warn(`Failed to send booking confirmation for booking ${booking.id}`, {
          bookingId: booking.id,
          error: err.message,
        }),
      );
    }

    // Fire-and-forget calendar sync
    this.calendarSyncService.syncBookingToCalendar(booking, 'create').catch((err) =>
      this.logger.warn(`Failed to sync booking ${booking.id} to calendar`, {
        bookingId: booking.id,
        error: err.message,
      }),
    );

    // Campaign attribution — link booking to recent campaign send
    this.attributeCampaignSend(booking.customerId, booking.id).catch((err) =>
      this.logger.warn(`Failed to attribute campaign send for booking ${booking.id}`, {
        bookingId: booking.id,
        error: err.message,
      }),
    );

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

        // M12 fix: Check for conflicts when rescheduling
        const staffId = data.staffId || booking.staffId;
        if (staffId) {
          const conflict = await this.prisma.booking.findFirst({
            where: {
              businessId,
              staffId,
              id: { not: id },
              status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
              startTime: { lt: data.endTime },
              endTime: { gt: data.startTime },
            },
          });
          if (conflict)
            throw new BadRequestException('Staff has a conflicting booking at this time');
        }
      }
    }
    const result = await this.prisma.booking.update({
      where: { id, businessId },
      data,
      include: { customer: true, service: true, staff: true },
    });

    // Fire-and-forget calendar sync
    this.calendarSyncService.syncBookingToCalendar(result, 'update').catch((err) =>
      this.logger.warn(`Failed to sync booking ${result.id} to calendar on update`, {
        bookingId: result.id,
        error: err.message,
      }),
    );

    return result;
  }

  async checkPolicyAllowed(
    businessId: string,
    bookingId: string,
    action: 'cancel' | 'reschedule',
  ): Promise<{
    allowed: boolean;
    reason?: string;
    policyText?: string;
    hoursRemaining?: number;
    adminCanOverride?: boolean;
  }> {
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

    const hoursUntilStart = (new Date(booking.startTime).getTime() - Date.now()) / 3600000;

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
    // C7 fix: Wrap status read + validation + update in transaction with row lock
    const { booking, previousStatus } = await this.prisma.$transaction(async (tx) => {
      // Lock booking row to prevent concurrent status transitions
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${id} AND "businessId" = ${businessId} FOR UPDATE`;

      const currentBooking = await tx.booking.findFirst({
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
            if (actor?.role === 'ADMIN') {
              if (!actor?.reason) {
                throw new BadRequestException(
                  'A reason is required to override the cancellation policy',
                );
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

      const updatedBooking = await tx.booking.update({
        where: { id, businessId },
        data: updateData,
        include: { customer: true, service: true, staff: true },
      });

      return { booking: updatedBooking, previousStatus: currentBooking?.status };
    });

    // Side effects outside transaction
    if (status === 'CONFIRMED' && previousStatus === 'PENDING_DEPOSIT') {
      this.notificationService.sendBookingConfirmation(booking).catch((err) =>
        this.logger.warn(`Failed to send confirmation after deposit override for booking ${id}`, {
          bookingId: id,
          error: err.message,
        }),
      );
    }

    if (['CANCELLED', 'NO_SHOW'].includes(status)) {
      await this.prisma.reminder.updateMany({
        where: { bookingId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      this.calendarSyncService.syncBookingToCalendar(booking, 'cancel').catch((err) =>
        this.logger.warn(`Failed to sync cancellation to calendar for booking ${id}`, {
          bookingId: id,
          error: err.message,
        }),
      );

      if (status === 'CANCELLED') {
        this.notificationService.sendCancellationNotification(booking).catch((err) =>
          this.logger.warn(`Failed to send cancellation notification for booking ${id}`, {
            bookingId: id,
            error: err.message,
          }),
        );
        if (this.waitlistService) {
          this.waitlistService.offerOpenSlot(booking).catch((err) =>
            this.logger.warn(`Failed to offer waitlist slot after cancellation of booking ${id}`, {
              bookingId: id,
              error: err.message,
            }),
          );
        }
      }
    }

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

  async updateKanbanStatus(businessId: string, id: string, kanbanStatus: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      include: { customer: true, service: true, staff: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const updated = await this.prisma.booking.update({
      where: { id, businessId },
      data: { kanbanStatus },
      include: { customer: true, service: true, staff: true },
    });

    // Fire-and-forget kanban status notification
    this.notificationService.sendKanbanStatusUpdate(updated, kanbanStatus).catch((err) =>
      this.logger.warn(`Failed to send kanban status notification for booking ${id}`, {
        bookingId: id,
        kanbanStatus,
        error: err.message,
      }),
    );

    this.logger.log(`Kanban status updated: booking=${id} status=${kanbanStatus}`);

    return updated;
  }

  async getKanbanBoard(
    businessId: string,
    query: {
      locationId?: string;
      staffId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const where: any = {
      businessId,
      kanbanStatus: { not: null },
      status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
    };
    if (query.locationId) where.locationId = query.locationId;
    if (query.staffId) where.staffId = query.staffId;
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    return this.prisma.booking.findMany({
      where,
      include: {
        customer: true,
        service: true,
        staff: true,
      },
      orderBy: { startTime: 'asc' },
    });
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

  async sendRescheduleLink(
    businessId: string,
    id: string,
    actor: { staffId: string; staffName: string },
  ) {
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
    this.notificationService.sendRescheduleLink(booking, rescheduleLink).catch((err) =>
      this.logger.warn(`Failed to send reschedule link for booking ${id}`, {
        bookingId: id,
        error: err.message,
      }),
    );

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

  async sendCancelLink(
    businessId: string,
    id: string,
    actor: { staffId: string; staffName: string },
  ) {
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
    this.notificationService.sendCancelLink(booking, cancelLink).catch((err) =>
      this.logger.warn(`Failed to send cancel link for booking ${id}`, {
        bookingId: id,
        error: err.message,
      }),
    );

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

  async bulkUpdate(
    businessId: string,
    ids: string[],
    action: 'status' | 'assign',
    payload: any,
    userRole?: string,
  ) {
    if (!ids?.length) throw new BadRequestException('No booking IDs provided');
    if (ids.length > 50)
      throw new BadRequestException('Cannot update more than 50 bookings at once');

    if (action === 'status') {
      if (!payload?.status) throw new BadRequestException('Status is required');
      // Only ADMIN can bulk-cancel
      if (payload.status === 'CANCELLED' && userRole !== 'ADMIN') {
        throw new ForbiddenException('Only admins can bulk-cancel bookings');
      }
      const result = await this.prisma.booking.updateMany({
        where: { id: { in: ids }, businessId },
        data: { status: payload.status },
      });
      // H8 fix: Audit log for bulk status changes
      this.logger.log(
        `BULK_STATUS_UPDATE business=${businessId} ids=[${ids.join(',')}] newStatus=${payload.status} updated=${result.count}`,
      );
      return { updated: result.count };
    }

    if (action === 'assign') {
      if (!payload?.staffId) throw new BadRequestException('Staff ID is required');
      const result = await this.prisma.booking.updateMany({
        where: { id: { in: ids }, businessId },
        data: { staffId: payload.staffId },
      });
      return { updated: result.count };
    }

    throw new BadRequestException(`Unknown bulk action: ${action}`);
  }

  async getCalendar(
    businessId: string,
    dateFrom: string,
    dateTo: string,
    staffId?: string,
    locationId?: string,
  ) {
    const where: any = {
      businessId,
      status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
      startTime: { gte: new Date(dateFrom) },
      endTime: { lte: new Date(dateTo) },
    };
    if (staffId) where.staffId = staffId;
    if (locationId) where.locationId = locationId;

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

  private async attributeCampaignSend(customerId: string, bookingId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSend = await this.prisma.campaignSend.findFirst({
      where: {
        customerId,
        status: 'SENT',
        sentAt: { gte: sevenDaysAgo },
        bookingId: null,
      },
      orderBy: { sentAt: 'desc' },
    });

    if (recentSend) {
      await this.prisma.campaignSend.update({
        where: { id: recentSend.id },
        data: { bookingId },
      });
    }
  }
}
