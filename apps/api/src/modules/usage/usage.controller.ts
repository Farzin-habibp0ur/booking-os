import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { UsageService } from './usage.service';

@ApiTags('Admin - Usage')
@Controller('admin/usage')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@AllowAnyRole()
@Roles('SUPER_ADMIN')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('rates')
  getRates() {
    return this.usageService.getRates();
  }

  @Get('all')
  async getAllUsage(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.usageService.getAllBusinessUsage(startDate, endDate);
  }

  @Get(':businessId')
  async getUsage(
    @Param('businessId') businessId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.usageService.getUsage(businessId, startDate, endDate);
  }

  @Get(':businessId/channels')
  async getUsageByChannel(@Param('businessId') businessId: string, @Query('month') month?: string) {
    const m = month || new Date().toISOString().slice(0, 7);
    return this.usageService.getUsageByChannel(businessId, m);
  }
}
