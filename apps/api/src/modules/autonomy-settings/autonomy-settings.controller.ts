import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AutonomySettingsService } from './autonomy-settings.service';
import { UpdateAutonomySettingDto } from './dto';

@Controller('autonomy-settings')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AutonomySettingsController {
  constructor(private readonly service: AutonomySettingsService) {}

  @Get()
  findAll(@BusinessId() businessId: string) {
    return this.service.findAll(businessId);
  }

  @Patch(':actionType')
  update(
    @BusinessId() businessId: string,
    @Param('actionType') actionType: string,
    @Body() dto: UpdateAutonomySettingDto,
  ) {
    return this.service.update(businessId, actionType, dto.level as any);
  }

  @Post('reset')
  reset(@BusinessId() businessId: string) {
    return this.service.resetToDefaults(businessId);
  }
}
