import { Controller, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { WaitlistService } from './waitlist.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@ApiTags('Waitlist')
@Controller('waitlist')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class WaitlistController {
  constructor(private waitlistService: WaitlistService) {}

  @Get()
  list(
    @BusinessId() businessId: string,
    @Query('status') status?: string,
    @Query('serviceId') serviceId?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.waitlistService.getEntries(businessId, { status, serviceId, staffId });
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: { status?: string; notes?: string; staffId?: string },
  ) {
    return this.waitlistService.updateEntry(businessId, id, body);
  }

  @Delete(':id')
  cancel(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.waitlistService.cancelEntry(businessId, id);
  }

  @Patch(':id/resolve')
  resolve(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: { bookingId: string },
  ) {
    return this.waitlistService.resolveEntry(businessId, id, body.bookingId);
  }
}
