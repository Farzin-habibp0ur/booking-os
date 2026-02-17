import { Injectable, BadRequestException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookingService } from '../booking/booking.service';
import { BusinessService } from '../business/business.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { QuoteService } from '../quote/quote.service';

@Injectable()
export class SelfServeService {
  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private availabilityService: AvailabilityService,
    private bookingService: BookingService,
    private businessService: BusinessService,
    private waitlistService: WaitlistService,
    @Optional() private quoteService?: QuoteService,
  ) {}

  async validateToken(token: string, type: 'RESCHEDULE_LINK' | 'CANCEL_LINK') {
    const record = await this.tokenService.validateToken(token, type);

    if (!record.bookingId) {
      throw new BadRequestException('Invalid token');
    }

    const booking = await this.prisma.booking.findFirst({
      where: { id: record.bookingId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
        business: { select: { id: true, name: true, slug: true, policySettings: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return { tokenRecord: record, booking };
  }

  async getBookingSummary(token: string, type: 'RESCHEDULE_LINK' | 'CANCEL_LINK') {
    const { booking } = await this.validateToken(token, type);

    const policySettings = await this.businessService.getPolicySettings(booking.businessId);
    const policyText =
      type === 'RESCHEDULE_LINK'
        ? policySettings?.reschedulePolicyText
        : policySettings?.cancellationPolicyText;

    return {
      booking: {
        id: booking.id,
        status: booking.status,
        startTime: booking.startTime,
        endTime: booking.endTime,
        service: booking.service,
        staff: booking.staff,
        customer: { name: booking.customer.name },
      },
      business: booking.business,
      policyText: policyText || undefined,
    };
  }

  async getAvailability(token: string, date: string) {
    const { booking } = await this.validateToken(token, 'RESCHEDULE_LINK');

    const slots = await this.availabilityService.getAvailableSlots(
      booking.businessId,
      date,
      booking.serviceId,
      booking.staffId || undefined,
    );

    return slots.filter((s) => s.available);
  }

  async executeReschedule(token: string, startTime: string, staffId?: string) {
    const { tokenRecord, booking } = await this.validateToken(token, 'RESCHEDULE_LINK');

    if (!['CONFIRMED', 'PENDING_DEPOSIT'].includes(booking.status)) {
      throw new BadRequestException('This booking cannot be rescheduled');
    }

    // Check policy
    const policy = await this.bookingService.checkPolicyAllowed(
      booking.businessId,
      booking.id,
      'reschedule',
    );
    if (!policy.allowed) {
      throw new BadRequestException(
        policy.policyText || policy.reason || 'Reschedule not allowed within the policy window',
      );
    }

    // C5 fix: Mark token used BEFORE executing action to prevent concurrent reuse
    await this.tokenService.markUsed(tokenRecord.id);

    // Update booking times
    const updated = await this.bookingService.update(booking.businessId, booking.id, {
      startTime,
      ...(staffId ? { staffId } : {}),
    });

    // Append to selfServeLog
    const existingFields = (booking.customFields as any) || {};
    const selfServeLog = Array.isArray(existingFields.selfServeLog)
      ? existingFields.selfServeLog
      : [];
    selfServeLog.push({
      type: 'RESCHEDULED_BY_CUSTOMER',
      at: new Date().toISOString(),
      newStartTime: startTime,
    });

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { customFields: { ...existingFields, selfServeLog } },
    });

    return updated;
  }

  async executeCancel(token: string, reason?: string) {
    const { tokenRecord, booking } = await this.validateToken(token, 'CANCEL_LINK');

    if (!['CONFIRMED', 'PENDING_DEPOSIT'].includes(booking.status)) {
      throw new BadRequestException('This booking cannot be cancelled');
    }

    // Check policy
    const policy = await this.bookingService.checkPolicyAllowed(
      booking.businessId,
      booking.id,
      'cancel',
    );
    if (!policy.allowed) {
      throw new BadRequestException(
        policy.policyText || policy.reason || 'Cancellation not allowed within the policy window',
      );
    }

    // C5 fix: Mark token used BEFORE executing action to prevent concurrent reuse
    await this.tokenService.markUsed(tokenRecord.id);

    // Cancel booking (no actor = customer action)
    const updated = await this.bookingService.updateStatus(
      booking.businessId,
      booking.id,
      'CANCELLED',
    );

    // Append to selfServeLog
    const existingFields = (booking.customFields as any) || {};
    const selfServeLog = Array.isArray(existingFields.selfServeLog)
      ? existingFields.selfServeLog
      : [];
    selfServeLog.push({
      type: 'CANCELLED_BY_CUSTOMER',
      at: new Date().toISOString(),
      reason: reason || undefined,
    });

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { customFields: { ...existingFields, selfServeLog } },
    });

    return updated;
  }

  async getWaitlistClaimSummary(token: string) {
    const record = await this.tokenService.validateToken(token, 'WAITLIST_CLAIM');

    if (!record.bookingId) {
      throw new BadRequestException('Invalid token');
    }

    // bookingId here stores the waitlistEntry id
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id: record.bookingId },
      include: {
        customer: { select: { id: true, name: true } },
        service: { select: { id: true, name: true, durationMins: true, price: true } },
        staff: { select: { id: true, name: true } },
        business: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!entry) throw new NotFoundException('Waitlist entry not found');
    if (entry.status !== 'OFFERED') {
      throw new BadRequestException('This offer is no longer available');
    }
    if (entry.offerExpiresAt && new Date() > entry.offerExpiresAt) {
      throw new BadRequestException('This offer has expired');
    }

    return {
      entry: {
        id: entry.id,
        status: entry.status,
        offeredSlot: entry.offeredSlot,
        offerExpiresAt: entry.offerExpiresAt,
        service: entry.service,
        staff: entry.staff,
        customer: { name: entry.customer.name },
      },
      business: entry.business,
    };
  }

  async claimWaitlistSlot(token: string) {
    const record = await this.tokenService.validateToken(token, 'WAITLIST_CLAIM');

    if (!record.bookingId) {
      throw new BadRequestException('Invalid token');
    }

    const entryId = record.bookingId;

    // C5 fix: Mark token used BEFORE executing action to prevent concurrent reuse
    await this.tokenService.markUsed(record.id);

    // C6 fix: Wrap waitlist entry check in transaction with row lock
    const { entry, slot } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "WaitlistEntry" WHERE id = ${entryId} FOR UPDATE`;

      const entry = await tx.waitlistEntry.findFirst({
        where: { id: entryId },
        include: {
          customer: true,
          service: true,
          staff: true,
        },
      });

      if (!entry) throw new NotFoundException('Waitlist entry not found');
      if (entry.status !== 'OFFERED') {
        throw new BadRequestException('This offer is no longer available');
      }
      if (entry.offerExpiresAt && new Date() > entry.offerExpiresAt) {
        throw new BadRequestException('This offer has expired');
      }

      const slot = entry.offeredSlot as any;
      if (!slot?.startTime) {
        throw new BadRequestException('Invalid offered slot data');
      }

      // Mark entry as claimed within transaction to prevent concurrent claims
      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: 'BOOKED' },
      });

      return { entry, slot };
    });

    // Create the booking (has its own transaction for conflict checking)
    const booking = await this.bookingService.create(entry.businessId, {
      customerId: entry.customerId,
      serviceId: entry.serviceId,
      staffId: entry.staffId || undefined,
      startTime: slot.startTime,
    });

    // Resolve the waitlist entry with booking ID
    await this.waitlistService.resolveEntry(entry.businessId, entry.id, booking.id);

    return booking;
  }

  async getQuoteForApproval(token: string) {
    if (!this.quoteService) {
      throw new BadRequestException('Quote system not available');
    }
    return this.quoteService.getQuoteForApproval(token);
  }

  async approveQuote(token: string, approverIp?: string) {
    if (!this.quoteService) {
      throw new BadRequestException('Quote system not available');
    }
    return this.quoteService.approveQuote(token, approverIp);
  }
}
