import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ExportService, ReportType } from './export.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { ReportsService } from '../reports/reports.service';

const VALID_REPORT_TYPES: ReportType[] = [
  'bookings-over-time',
  'revenue-over-time',
  'no-show-rate',
  'response-times',
  'service-breakdown',
  'staff-performance',
  'status-breakdown',
  'peak-hours',
  'consult-conversion',
  'deposit-compliance',
];

@ApiTags('Export')
@Controller()
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class ExportController {
  constructor(
    private exportService: ExportService,
    private reportsService: ReportsService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Get('customers/export')
  async exportCustomers(
    @BusinessId() businessId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('fields') fields?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportCustomersCsv(businessId, {
      dateFrom,
      dateTo,
      fields: fields ? fields.split(',').map((f) => f.trim()) : undefined,
    });

    const filename = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.send(csv);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Get('bookings/export')
  async exportBookings(
    @BusinessId() businessId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('fields') fields?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportBookingsCsv(businessId, {
      dateFrom,
      dateTo,
      fields: fields ? fields.split(',').map((f) => f.trim()) : undefined,
    });

    const filename = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.send(csv);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Get('staff/export')
  async exportStaff(
    @BusinessId() businessId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('fields') fields?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportStaffCsv(businessId, {
      dateFrom,
      dateTo,
      fields: fields ? fields.split(',').map((f) => f.trim()) : undefined,
    });

    const filename = `staff-${new Date().toISOString().split('T')[0]}.csv`;
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.send(csv);
  }

  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Get('reports/:reportType/export')
  async exportReport(
    @BusinessId() businessId: string,
    @Param('reportType') reportType: string,
    @Query('days') days?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    if (!VALID_REPORT_TYPES.includes(reportType as ReportType)) {
      throw new BadRequestException(`Invalid report type: ${reportType}`);
    }

    const parsedDays = days ? parseInt(days) : 30;
    const startDate = from ? new Date(from) : undefined;
    const endDate = to ? new Date(to) : undefined;
    const data = await this.getReportData(
      businessId,
      reportType as ReportType,
      parsedDays,
      startDate,
      endDate,
    );
    const exportFormat = format === 'pdf' ? 'pdf' : 'csv';

    if (exportFormat === 'pdf') {
      const html = this.exportService.exportReportPdf(reportType as ReportType, data);
      const filename = `${reportType}-${new Date().toISOString().split('T')[0]}.html`;
      res!.setHeader('Content-Type', 'text/html; charset=utf-8');
      res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res!.send(html);
    } else {
      const csv = this.exportService.exportReportCsv(reportType as ReportType, data);
      const filename = `${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
      res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res!.send(csv);
    }
  }

  private async getReportData(
    businessId: string,
    reportType: ReportType,
    days: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    switch (reportType) {
      case 'bookings-over-time':
        return this.reportsService.bookingsOverTime(businessId, days, startDate, endDate);
      case 'revenue-over-time':
        return this.reportsService.revenueOverTime(businessId, days, startDate, endDate);
      case 'no-show-rate':
        return this.reportsService.noShowRate(businessId, days, startDate, endDate);
      case 'response-times':
        return this.reportsService.responseTimes(businessId);
      case 'service-breakdown':
        return this.reportsService.serviceBreakdown(businessId, days, startDate, endDate);
      case 'staff-performance':
        return this.reportsService.staffPerformance(businessId, days, startDate, endDate);
      case 'status-breakdown':
        return this.reportsService.statusBreakdown(businessId, days, startDate, endDate);
      case 'peak-hours':
        return this.reportsService.peakHours(businessId, days, startDate, endDate);
      case 'consult-conversion':
        return this.reportsService.consultToTreatmentConversion(
          businessId,
          days,
          startDate,
          endDate,
        );
      case 'deposit-compliance':
        return this.reportsService.depositComplianceRate(businessId, startDate, endDate);
      default:
        throw new BadRequestException(`Invalid report type: ${reportType}`);
    }
  }
}
