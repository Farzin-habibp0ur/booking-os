import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AvailabilityService } from './availability.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@ApiTags('Availability')
@Controller('availability')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get('recommended-slots')
  getRecommendedSlots(
    @BusinessId() businessId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
    @Query('excludeBookingId') excludeBookingId?: string,
  ) {
    if (!serviceId || !date) {
      throw new BadRequestException('serviceId and date are required');
    }
    return this.availabilityService.getRecommendedSlots(
      businessId,
      serviceId,
      date,
      excludeBookingId,
    );
  }

  @Get('calendar-context')
  getCalendarContext(
    @BusinessId() businessId: string,
    @Query('staffIds') staffIds: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException('dateFrom and dateTo are required');
    }
    const ids = staffIds ? staffIds.split(',').map((id) => id.trim()) : [];
    return this.availabilityService.getCalendarContext(businessId, ids, dateFrom, dateTo);
  }

  @Get()
  getSlots(
    @BusinessId() businessId: string,
    @Query('date') date: string,
    @Query('serviceId') serviceId: string,
    @Query('staffId') staffId?: string,
    @Query('locationId') locationId?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.availabilityService.getAvailableSlots(
      businessId,
      date,
      serviceId,
      staffId,
      locationId,
      resourceId,
    );
  }
}
