import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { QualityGateService } from './quality-gates.service';

@Controller('quality-gates')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class QualityGateController {
  constructor(private readonly service: QualityGateService) {}

  @Post(':draftId/evaluate/:gate')
  evaluateGate(
    @BusinessId() businessId: string,
    @Param('draftId') draftId: string,
    @Param('gate') gate: string,
  ) {
    return this.service.evaluateGate(businessId, draftId, gate);
  }

  @Get(':draftId/status')
  getGateStatus(@BusinessId() businessId: string, @Param('draftId') draftId: string) {
    return this.service.getGateStatus(businessId, draftId);
  }
}
