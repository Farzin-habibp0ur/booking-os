import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BookingService } from './booking.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { CreateBookingDto, UpdateBookingDto, UpdateBookingStatusDto } from '../../common/dto';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
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

  @Get(':id/policy-check')
  policyCheck(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Query('action') action: 'cancel' | 'reschedule',
  ) {
    return this.bookingService.checkPolicyAllowed(businessId, id, action || 'cancel');
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
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateBookingDto,
  ) {
    return this.bookingService.update(businessId, id, body);
  }

  @Patch(':id/status')
  updateStatus(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateBookingStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingService.updateStatus(businessId, id, body.status, {
      reason: body.reason,
      staffId: user?.id,
      staffName: user?.name,
      role: user?.role,
    });
  }

  @Patch('bulk')
  bulkAction(
    @BusinessId() businessId: string,
    @Body() body: { ids: string[]; action: 'status' | 'assign'; payload: any },
    @CurrentUser() user: any,
  ) {
    return this.bookingService.bulkUpdate(
      businessId,
      body.ids,
      body.action,
      body.payload,
      user?.role,
    );
  }

  @Post(':id/send-deposit-request')
  sendDepositRequest(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.bookingService.sendDepositRequest(businessId, id);
  }

  @Post(':id/send-reschedule-link')
  sendRescheduleLink(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.bookingService.sendRescheduleLink(businessId, id, {
      staffId: user?.id,
      staffName: user?.name,
    });
  }

  @Post(':id/send-cancel-link')
  sendCancelLink(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.bookingService.sendCancelLink(businessId, id, {
      staffId: user?.id,
      staffName: user?.name,
    });
  }
}
