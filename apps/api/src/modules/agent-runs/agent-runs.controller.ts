import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AgentRunsService } from './agent-runs.service';
import { QueryAgentRunsDto } from './dto';

@Controller('agent-runs')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class AgentRunsController {
  constructor(private readonly service: AgentRunsService) {}

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: QueryAgentRunsDto) {
    return this.service.findAll(businessId, query);
  }

  @Get('stats')
  getStats(@BusinessId() businessId: string) {
    return this.service.getStats(businessId);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }
}
