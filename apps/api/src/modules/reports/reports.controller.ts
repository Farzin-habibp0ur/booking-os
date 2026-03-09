import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { ReportScheduleService } from './report-schedule.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto';
import { UpdateReportScheduleDto } from './dto/update-report-schedule.dto';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
    private reportScheduleService: ReportScheduleService,
  ) {}

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

  // ─── Report Schedules ──────────────────────────────────────────────

  @Post('schedules')
  createSchedule(@BusinessId() businessId: string, @Body() dto: CreateReportScheduleDto) {
    return this.reportScheduleService.create(businessId, dto);
  }

  @Get('schedules')
  listSchedules(@BusinessId() businessId: string) {
    return this.reportScheduleService.findAll(businessId);
  }

  @Patch('schedules/:id')
  updateSchedule(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReportScheduleDto,
  ) {
    return this.reportScheduleService.update(businessId, id, dto);
  }

  @Delete('schedules/:id')
  deleteSchedule(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.reportScheduleService.remove(businessId, id);
  }
}
