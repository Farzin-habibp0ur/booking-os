import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TreatmentPlanService } from './treatment-plan.service';
import { CreateTreatmentPlanDto } from './dto/create-treatment-plan.dto';
import {
  UpdateTreatmentPlanDto,
  AddSessionDto,
  UpdateSessionDto,
} from './dto/update-treatment-plan.dto';

@ApiTags('Treatment Plans')
@Controller('treatment-plans')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class TreatmentPlanController {
  constructor(private readonly service: TreatmentPlanService) {}

  @Post()
  create(
    @BusinessId() businessId: string,
    @CurrentUser() user: any,
    @Body() body: CreateTreatmentPlanDto,
  ) {
    return this.service.create(businessId, user.id, body);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query('customerId') customerId?: string) {
    return this.service.findAll(businessId, customerId);
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateTreatmentPlanDto,
  ) {
    return this.service.update(businessId, id, body);
  }

  @Post(':id/sessions')
  addSession(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: AddSessionDto,
  ) {
    return this.service.addSession(businessId, id, body);
  }

  @Patch(':id/sessions/:sid')
  updateSession(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Body() body: UpdateSessionDto,
  ) {
    return this.service.updateSession(businessId, id, sid, body);
  }

  @Post(':id/propose')
  propose(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.propose(businessId, id);
  }

  @Post(':id/accept')
  accept(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.accept(businessId, id);
  }
}
