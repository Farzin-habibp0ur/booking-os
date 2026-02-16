import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('bookings-over-time')
  bookingsOverTime(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.reportsService.bookingsOverTime(businessId, days ? parseInt(days) : undefined);
  }

  @Get('no-show-rate')
  noShowRate(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.reportsService.noShowRate(businessId, days ? parseInt(days) : undefined);
  }

  @Get('response-times')
  responseTimes(@BusinessId() businessId: string) {
    return this.reportsService.responseTimes(businessId);
  }

  @Get('service-breakdown')
  serviceBreakdown(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.reportsService.serviceBreakdown(businessId, days ? parseInt(days) : undefined);
  }

  @Get('staff-performance')
  staffPerformance(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.reportsService.staffPerformance(businessId, days ? parseInt(days) : undefined);
  }

  @Get('revenue-over-time')
  revenueOverTime(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.reportsService.revenueOverTime(businessId, days ? parseInt(days) : undefined);
  }

  @Get('status-breakdown')
  statusBreakdown(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.reportsService.statusBreakdown(businessId, days ? parseInt(days) : undefined);
  }

  @Get('peak-hours')
  peakHours(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.reportsService.peakHours(businessId, days ? parseInt(days) : undefined);
  }

  @Get('consult-conversion')
  consultConversion(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.reportsService.consultToTreatmentConversion(
      businessId,
      days ? parseInt(days) : undefined,
    );
  }
}
