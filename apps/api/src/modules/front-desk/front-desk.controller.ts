import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { BusinessId } from '../../common/decorators';
import { RolesGuard, AllowAnyRole } from '../../common/roles.guard';
import { TenantGuard } from '../../common/tenant.guard';
import { FrontDeskService } from './front-desk.service';

@ApiTags('Front Desk')
@Controller('front-desk')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
@Throttle({ default: { ttl: 60000, limit: 60 } })
export class FrontDeskController {
  constructor(private frontDesk: FrontDeskService) {}

  @Get('summary')
  getSummary(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.frontDesk.getSummary(businessId, days ? Number(days) : 30);
  }
}
