import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { ActionCardService } from './action-card.service';
import { ActionCardExecutorService } from './action-card-executor.service';
import { BulkUpdateActionCardsDto } from './dto';

@Controller('action-cards')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class ActionCardController {
  constructor(
    private actionCardService: ActionCardService,
    private actionCardExecutorService: ActionCardExecutorService,
  ) {}

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

  @Get('summary')
  getSummary(@BusinessId() businessId: string) {
    return this.actionCardService.getSummary(businessId);
  }

  @Post('bulk-followup')
  async bulkFollowup(
    @BusinessId() businessId: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: { cardIds: string[] },
  ) {
    const results = [];
    for (const cardId of body.cardIds) {
      const card = await this.actionCardService.findById(businessId, cardId);
      if (card && card.status === 'PENDING') {
        const result = await this.actionCardExecutorService.executeCta(
          businessId,
          card,
          'send_followup',
          staffId,
        );
        if (result.success) {
          await this.actionCardService.execute(businessId, cardId, staffId);
        }
        results.push({ cardId, ...result });
      }
    }
    return {
      created: results.filter((r) => r.success).length,
      total: body.cardIds.length,
      results,
    };
  }

  @Post('bulk-update')
  @Roles('OWNER', 'ADMIN')
  bulkUpdate(
    @BusinessId() businessId: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: BulkUpdateActionCardsDto,
  ) {
    return this.actionCardService.bulkUpdate(businessId, body.cardIds, body.status, staffId);
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
  async execute(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser('sub') staffId: string,
    @CurrentUser('name') staffName: string,
    @Body() body?: { ctaAction?: string },
  ) {
    const card = await this.actionCardService.findById(businessId, id);

    // If a ctaAction is specified, route through the executor
    if (body?.ctaAction) {
      const result = await this.actionCardExecutorService.executeCta(
        businessId,
        card,
        body.ctaAction,
        staffId,
      );

      // Mark card as executed if CTA succeeded (except dismiss which is handled separately)
      if (result.success && body.ctaAction !== 'dismiss') {
        await this.actionCardService.execute(businessId, id, staffId, staffName);
      }

      return result;
    }

    // Default: just mark as executed (backward compat)
    return this.actionCardService.execute(businessId, id, staffId, staffName);
  }
}
