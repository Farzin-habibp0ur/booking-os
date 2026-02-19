import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ExportService } from './export.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';

@ApiTags('Export')
@Controller()
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class ExportController {
  constructor(private exportService: ExportService) {}

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
}
