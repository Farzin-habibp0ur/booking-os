import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RoiService } from './roi.service';
import { BusinessId } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';

@ApiTags('ROI')
@Controller('roi')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('ADMIN')
export class RoiController {
  constructor(private roiService: RoiService) {}

  @Post('go-live')
  goLive(@BusinessId() businessId: string) {
    return this.roiService.goLive(businessId);
  }

  @Get('baseline')
  getBaseline(@BusinessId() businessId: string) {
    return this.roiService.getBaseline(businessId);
  }

  @Get('dashboard')
  getDashboard(@BusinessId() businessId: string, @Query('days') days?: string) {
    return this.roiService.getRoiDashboard(businessId, days ? parseInt(days, 10) : 30);
  }
}
