import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId } from '../../common/decorators';
import { AbTestingService } from './ab-testing.service';
import { CreateAbTestDto, UpdateAbTestDto, QueryAbTestsDto } from './dto';

@Controller('ab-testing')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AbTestingController {
  constructor(private readonly service: AbTestingService) {}

  @Post()
  create(@BusinessId() businessId: string, @Body() body: CreateAbTestDto) {
    return this.service.create(businessId, body);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: QueryAbTestsDto) {
    return this.service.findAll(businessId, query);
  }

  @Get('active')
  findActive(@BusinessId() businessId: string) {
    return this.service.findActive(businessId);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: UpdateAbTestDto) {
    return this.service.update(businessId, id, body);
  }

  @Post(':id/start')
  start(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.start(businessId, id);
  }

  @Post(':id/complete')
  complete(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.complete(businessId, id);
  }

  @Post(':id/cancel')
  cancel(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.cancel(businessId, id);
  }
}
