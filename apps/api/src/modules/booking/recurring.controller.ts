import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecurringService } from './recurring.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { CreateRecurringSeriesDto, CancelRecurringSeriesDto } from '../../common/dto';

@Controller('bookings/recurring')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class RecurringController {
  constructor(private recurringService: RecurringService) {}

  @Post()
  createSeries(@BusinessId() businessId: string, @Body() body: CreateRecurringSeriesDto) {
    return this.recurringService.createSeries(businessId, body);
  }

  @Get(':seriesId')
  getSeriesDetail(@BusinessId() businessId: string, @Param('seriesId') seriesId: string) {
    return this.recurringService.getSeriesById(businessId, seriesId);
  }

  @Post(':seriesId/cancel')
  cancelSeries(
    @BusinessId() businessId: string,
    @Param('seriesId') seriesId: string,
    @Body() body: CancelRecurringSeriesDto,
  ) {
    return this.recurringService.cancelSeries(businessId, seriesId, body.scope, body.bookingId);
  }
}
