import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { BookingService } from './booking.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import {
  CreateBookingDto,
  UpdateBookingDto,
  UpdateBookingStatusDto,
  UpdateKanbanStatusDto,
} from '../../common/dto';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class BookingController {
  constructor(private bookingService: BookingService) {}

  @Get()
  list(@BusinessId() businessId: string, @Query() query: any) {
    return this.bookingService.findAll(businessId, query);
  }

  @Get('calendar/month-summary')
  monthSummary(
    @BusinessId() businessId: string,
    @Query('month') month: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.bookingService.getMonthSummary(businessId, month, locationId);
  }

  @Get('calendar')
  calendar(
    @BusinessId() businessId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('staffId') staffId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.bookingService.getCalendar(businessId, dateFrom, dateTo, staffId, locationId);
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
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  create(
    @BusinessId() businessId: string,
    @Body() body: CreateBookingDto,
    @CurrentUser() user: any,
  ) {
    // Security fix: Only ADMIN can force-book (override conflicts)
    if (body.forceBook && user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can force book');
    }
    const currentUser = body.forceBook
      ? { staffId: user.id, staffName: user.name, role: user.role }
      : undefined;
    return this.bookingService.create(businessId, body, currentUser);
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

  @Get('kanban')
  kanbanBoard(
    @BusinessId() businessId: string,
    @Query('locationId') locationId?: string,
    @Query('staffId') staffId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.bookingService.getKanbanBoard(businessId, {
      locationId,
      staffId,
      dateFrom,
      dateTo,
    });
  }

  @Patch(':id/kanban-status')
  updateKanbanStatus(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateKanbanStatusDto,
  ) {
    return this.bookingService.updateKanbanStatus(businessId, id, body.kanbanStatus);
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
