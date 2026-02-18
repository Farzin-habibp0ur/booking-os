import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId } from '../../common/decorators';
import { ActionHistoryService } from './action-history.service';

@Controller('action-history')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ActionHistoryController {
  constructor(private actionHistoryService: ActionHistoryService) {}

  @Get()
  findAll(
    @BusinessId() businessId: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.actionHistoryService.findAll(businessId, {
      entityType,
      entityId,
      actorId,
      action,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('entity/:entityType/:entityId')
  findByEntity(
    @BusinessId() businessId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.actionHistoryService.findByEntity(businessId, entityType, entityId);
  }
}
