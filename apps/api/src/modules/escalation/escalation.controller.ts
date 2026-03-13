import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { EscalationService } from './escalation.service';
import { QueryEscalationDto } from './dto';

@Controller('escalation')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class EscalationController {
  constructor(private readonly service: EscalationService) {}

  @Get('history')
  getHistory(@BusinessId() businessId: string, @Query() query: QueryEscalationDto) {
    return this.service.getHistory(businessId, query);
  }

  @Get('stats')
  getStats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }
}
