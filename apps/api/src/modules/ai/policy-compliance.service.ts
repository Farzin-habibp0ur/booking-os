import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  policyText?: string;
}

@Injectable()
export class PolicyComplianceService {
  private readonly logger = new Logger(PolicyComplianceService.name);

  constructor(private prisma: PrismaService) {}

  async checkDepositPolicy(businessId: string, serviceId: string): Promise<PolicyCheckResult> {
    try {
      const service = await this.prisma.service.findFirst({
        where: { id: serviceId, businessId },
      });

      if (!service) {
        return { allowed: false, reason: 'Service not found' };
      }

      if (!service.depositRequired) {
        return { allowed: false, reason: 'Service does not require deposit' };
      }

      if (!service.depositAmount || service.depositAmount <= 0) {
        return { allowed: false, reason: 'No deposit amount configured' };
      }

      return {
        allowed: true,
        reason: `Deposit of $${service.depositAmount.toFixed(2)} required`,
      };
    } catch (err: any) {
      this.logger.error(`Deposit policy check failed: ${err.message}`);
      return { allowed: false, reason: 'Policy check failed' };
    }
  }

  async checkCancellationPolicy(businessId: string, bookingId: string): Promise<PolicyCheckResult> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });
      if (!business) return { allowed: false, reason: 'Business not found' };

      const policy = (business.policySettings as any) || {};
      if (!policy.policyEnabled) {
        return { allowed: true, reason: 'No cancellation policy configured' };
      }

      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, businessId },
      });
      if (!booking) return { allowed: false, reason: 'Booking not found' };

      const hoursUntilBooking = (booking.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
      const windowHours = policy.cancellationWindowHours || 24;

      if (hoursUntilBooking < windowHours) {
        return {
          allowed: false,
          reason: `Cancellation not allowed within ${windowHours} hours of appointment`,
          policyText: policy.cancellationPolicyText,
        };
      }

      return { allowed: true };
    } catch (err: any) {
      this.logger.error(`Cancellation policy check failed: ${err.message}`);
      return { allowed: false, reason: 'Policy check failed' };
    }
  }

  async checkReschedulePolicy(businessId: string, bookingId: string): Promise<PolicyCheckResult> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });
      if (!business) return { allowed: false, reason: 'Business not found' };

      const policy = (business.policySettings as any) || {};
      if (!policy.policyEnabled) {
        return { allowed: true, reason: 'No reschedule policy configured' };
      }

      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, businessId },
      });
      if (!booking) return { allowed: false, reason: 'Booking not found' };

      const hoursUntilBooking = (booking.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
      const windowHours = policy.rescheduleWindowHours || 24;

      if (hoursUntilBooking < windowHours) {
        return {
          allowed: false,
          reason: `Reschedule not allowed within ${windowHours} hours of appointment`,
          policyText: policy.reschedulePolicyText,
        };
      }

      return { allowed: true };
    } catch (err: any) {
      this.logger.error(`Reschedule policy check failed: ${err.message}`);
      return { allowed: false, reason: 'Policy check failed' };
    }
  }

  async checkQuietHours(businessId: string): Promise<boolean> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
      });
      if (!business) return false;

      const settings = (business.notificationSettings as any) || {};
      const quietStart = settings.quietStart;
      const quietEnd = settings.quietEnd;

      if (!quietStart || !quietEnd) return false;

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = quietStart.split(':').map(Number);
      const [endH, endM] = quietEnd.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      }
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } catch (err: any) {
      this.logger.error(`Quiet hours check failed: ${err.message}`);
      return false;
    }
  }
}
