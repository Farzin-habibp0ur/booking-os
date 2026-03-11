import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { DealService } from './deal.service';
import { CreateDealDto, UpdateDealDto, ChangeStageDto, CreateActivityDto } from './dto';

@Controller('deals')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class DealController {
  constructor(private readonly dealService: DealService) {}

  @Post()
  create(
    @BusinessId() businessId: string,
    @Body() body: CreateDealDto,
    @CurrentUser() user: any,
  ) {
    return this.dealService.create(businessId, body, user.id);
  }

  @Get('pipeline')
  pipeline(@BusinessId() businessId: string) {
    return this.dealService.pipeline(businessId);
  }

  @Get('stats')
  stats(@BusinessId() businessId: string) {
    return this.dealService.stats(businessId);
  }

  @Get()
  findAll(
    @BusinessId() businessId: string,
    @Query('stage') stage?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.dealService.findAll(businessId, { stage, assignedToId, customerId });
  }

  @Get(':id')
  findOne(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.dealService.findOne(businessId, id);
  }

  @Patch(':id')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateDealDto,
  ) {
    return this.dealService.update(businessId, id, body);
  }

  @Patch(':id/stage')
  changeStage(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: ChangeStageDto,
    @CurrentUser() user: any,
  ) {
    return this.dealService.changeStage(businessId, id, body, user.id);
  }

  @Post(':id/activities')
  addActivity(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: CreateActivityDto,
    @CurrentUser() user: any,
  ) {
    return this.dealService.addActivity(businessId, id, body, user.id);
  }

  @Get(':id/activities')
  getActivities(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.dealService.getActivities(businessId, id);
  }
}
