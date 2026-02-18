import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AutonomyService } from './autonomy.service';

@Controller('autonomy')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class AutonomyController {
  constructor(private autonomyService: AutonomyService) {}

  @Get()
  getConfigs(@BusinessId() businessId: string) {
    return this.autonomyService.getConfigs(businessId);
  }

  @Get(':actionType')
  getConfig(@BusinessId() businessId: string, @Param('actionType') actionType: string) {
    return this.autonomyService.getConfig(businessId, actionType);
  }

  @Get(':actionType/level')
  getLevel(@BusinessId() businessId: string, @Param('actionType') actionType: string) {
    return this.autonomyService.getLevel(businessId, actionType);
  }

  @Patch(':actionType')
  @Roles('ADMIN')
  upsertConfig(
    @BusinessId() businessId: string,
    @Param('actionType') actionType: string,
    @Body() body: { autonomyLevel: string; requiredRole?: string; constraints?: any },
  ) {
    return this.autonomyService.upsertConfig(businessId, actionType, {
      autonomyLevel: body.autonomyLevel as any,
      requiredRole: body.requiredRole,
      constraints: body.constraints,
    });
  }
}
