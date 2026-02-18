import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { ActionCardService } from './action-card.service';

@Controller('action-cards')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ActionCardController {
  constructor(private actionCardService: ActionCardService) {}

  @Get()
  findAll(
    @BusinessId() businessId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('type') type?: string,
    @Query('staffId') staffId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.actionCardService.findAll(businessId, {
      status,
      category,
      type,
      staffId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('count')
  pendingCount(@BusinessId() businessId: string, @Query('staffId') staffId?: string) {
    return this.actionCardService.getPendingCount(businessId, staffId);
  }

  @Get(':id')
  findById(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.actionCardService.findById(businessId, id);
  }

  @Patch(':id/approve')
  approve(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser('sub') staffId: string,
    @CurrentUser('name') staffName: string,
  ) {
    return this.actionCardService.approve(businessId, id, staffId, staffName);
  }

  @Patch(':id/dismiss')
  dismiss(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser('sub') staffId: string,
    @CurrentUser('name') staffName: string,
  ) {
    return this.actionCardService.dismiss(businessId, id, staffId, staffName);
  }

  @Patch(':id/snooze')
  snooze(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: { until: string },
  ) {
    return this.actionCardService.snooze(businessId, id, new Date(body.until), staffId);
  }

  @Patch(':id/execute')
  execute(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser('sub') staffId: string,
    @CurrentUser('name') staffName: string,
  ) {
    return this.actionCardService.execute(businessId, id, staffId, staffName);
  }
}
