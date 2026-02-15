import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookingService } from './booking.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { CreateBookingDto, UpdateBookingDto, UpdateBookingStatusDto } from '../../common/dto';

@Controller('bookings')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @Get()
  list(@BusinessId() businessId: string, @Query() query: any) {
    return this.bookingService.findAll(businessId, query);
  }

  @Get('calendar')
  calendar(
    @BusinessId() businessId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.bookingService.getCalendar(businessId, dateFrom, dateTo, staffId);
  }

  @Get(':id')
  detail(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.bookingService.findById(businessId, id);
  }

  @Post()
  create(@BusinessId() businessId: string, @Body() body: CreateBookingDto) {
    return this.bookingService.create(businessId, body);
  }

  @Patch(':id')
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: UpdateBookingDto) {
    return this.bookingService.update(businessId, id, body);
  }

  @Patch(':id/status')
  updateStatus(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: UpdateBookingStatusDto) {
    return this.bookingService.updateStatus(businessId, id, body.status);
  }
}
