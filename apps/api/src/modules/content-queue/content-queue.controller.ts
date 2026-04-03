import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { ContentQueueService } from './content-queue.service';
import { CreateContentDraftDto, UpdateContentDraftDto, ListContentDraftsDto } from './dto';

@Controller('content-queue')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
@AllowAnyRole()
export class ContentQueueController {
  constructor(private readonly service: ContentQueueService) {}

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@BusinessId() businessId: string, @Body() body: CreateContentDraftDto) {
    return this.service.create(businessId, body);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: ListContentDraftsDto) {
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

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateContentDraftDto,
  ) {
    return this.service.update(businessId, id, body);
  }

  @Post(':id/approve')
  @Roles('OWNER', 'ADMIN')
  approve(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { scheduledFor?: string },
  ) {
    return this.service.approve(businessId, id, user.id, body.scheduledFor);
  }

  @Post(':id/reject')
  @Roles('OWNER', 'ADMIN')
  reject(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { reviewNote: string },
  ) {
    return this.service.reject(businessId, id, user.id, body.reviewNote);
  }

  @Post('bulk-approve')
  @Roles('OWNER', 'ADMIN')
  bulkApprove(
    @BusinessId() businessId: string,
    @CurrentUser() user: any,
    @Body() body: { ids: string[] },
  ) {
    return this.service.bulkApprove(businessId, body.ids, user.id);
  }

  @Post('bulk-reject')
  @Roles('OWNER', 'ADMIN')
  bulkReject(
    @BusinessId() businessId: string,
    @CurrentUser() user: any,
    @Body() body: { ids: string[]; reviewNote: string },
  ) {
    return this.service.bulkReject(businessId, body.ids, user.id, body.reviewNote);
  }
}
