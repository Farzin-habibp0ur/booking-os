import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId } from '../../common/decorators';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { CockpitTasksService } from './cockpit-tasks.service';
import { CockpitDetailService } from './cockpit-detail.service';

@Controller('cockpit')
@UseGuards(TenantGuard, RolesGuard)
export class CockpitController {
  constructor(
    private cockpitTasksService: CockpitTasksService,
    private cockpitDetailService: CockpitDetailService,
  ) {}

  @Get('daily-tasks')
  @Roles('OWNER', 'ADMIN')
  async getDailyTasks(@BusinessId() businessId: string) {
    return this.cockpitTasksService.generateDailyTasks(businessId);
  }

  @Post('daily-tasks/:taskId/detail')
  @Roles('OWNER', 'ADMIN')
  async getTaskDetail(
    @BusinessId() businessId: string,
    @Param('taskId') taskId: string,
    @Body()
    body: {
      linkedEntities: Array<{
        type: string;
        id: string;
        label: string;
        status?: string;
      }>;
      title: string;
      description: string;
    },
  ) {
    return this.cockpitDetailService.getDailyTaskDetail(
      businessId,
      taskId,
      body.linkedEntities as any,
      body.title,
      body.description,
    );
  }
}
