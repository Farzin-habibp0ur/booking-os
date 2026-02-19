import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId } from '../../common/decorators';
import { ActionHistoryService } from './action-history.service';

@Controller('action-history')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class ActionHistoryController {
  constructor(private actionHistoryService: ActionHistoryService) {}

  @Get('export')
  async exportCsv(
    @BusinessId() businessId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('entityType') entityType?: string,
    @Query('actorType') actorType?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.actionHistoryService.exportCsv(businessId, {
      dateFrom,
      dateTo,
      entityType,
      actorType,
    });

    const filename = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.send(csv);
  }

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
