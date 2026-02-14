import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AvailabilityService } from './availability.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@Controller('availability')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get()
  getSlots(
    @BusinessId() businessId: string,
    @Query('date') date: string,
    @Query('serviceId') serviceId: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.availabilityService.getAvailableSlots(businessId, date, serviceId, staffId);
  }
}
