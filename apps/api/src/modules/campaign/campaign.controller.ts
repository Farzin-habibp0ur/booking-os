import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles, AllowAnyRole } from '../../common/roles.guard';
import { PlanGuard, RequiresFeature } from '../../common/plan.guard';
import { BusinessId } from '../../common/decorators';
import { CampaignService } from './campaign.service';
import { SavedSegmentService } from './saved-segment.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  PreviewAudienceDto,
  CreateSavedSegmentDto,
  UpdateSavedSegmentDto,
  SelectWinnerDto,
} from '../../common/dto';

// Public endpoint — no auth required
@Controller('campaigns/unsubscribe')
export class CampaignUnsubscribeController {
  constructor(private campaignService: CampaignService) {}

  @Get(':token')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async unsubscribe(@Param('token') token: string) {
    return this.campaignService.processUnsubscribe(token);
  }
}

@Controller('campaigns')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard, PlanGuard)
@AllowAnyRole()
@RequiresFeature('campaigns')
export class CampaignController {
  constructor(
    private campaignService: CampaignService,
    private savedSegmentService: SavedSegmentService,
  ) {}

  @Post()
  @Roles('ADMIN')
  create(@BusinessId() businessId: string, @Body() body: CreateCampaignDto) {
    return this.campaignService.create(businessId, body);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: any) {
    return this.campaignService.findAll(businessId, query);
  }

  // P-16: Standalone audience preview (no campaign ID required)
  @Post('audience-preview')
  audiencePreview(@BusinessId() businessId: string, @Body() body: PreviewAudienceDto) {
    return this.campaignService.previewAudience(businessId, body.filters);
  }

  // P-16: SavedSegment CRUD — static routes before :id
  @Get('segments')
  listSegments(@BusinessId() businessId: string) {
    return this.savedSegmentService.findAll(businessId);
  }

  @Post('segments')
  @Roles('ADMIN')
  createSegment(@BusinessId() businessId: string, @Body() body: CreateSavedSegmentDto) {
    return this.savedSegmentService.create(businessId, body);
  }

  @Patch('segments/:segmentId')
  @Roles('ADMIN')
  updateSegment(
    @BusinessId() businessId: string,
    @Param('segmentId') segmentId: string,
    @Body() body: UpdateSavedSegmentDto,
  ) {
    return this.savedSegmentService.update(businessId, segmentId, body);
  }

  @Delete('segments/:segmentId')
  @Roles('ADMIN')
  deleteSegment(@BusinessId() businessId: string, @Param('segmentId') segmentId: string) {
    return this.savedSegmentService.delete(businessId, segmentId);
  }

  @Get('performance')
  performance(@BusinessId() businessId: string) {
    return this.campaignService.getPerformanceSummary(businessId);
  }

  // Parameterized routes below
  @Get(':id')
  findById(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.findById(businessId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: UpdateCampaignDto,
  ) {
    return this.campaignService.update(businessId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.delete(businessId, id);
  }

  @Post(':id/cancel')
  @Roles('ADMIN')
  cancel(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.cancelCampaign(businessId, id);
  }

  @Post(':id/send')
  @Roles('ADMIN')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  send(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.sendCampaign(businessId, id);
  }

  @Post(':id/preview')
  previewAudience(@BusinessId() businessId: string, @Body() body: PreviewAudienceDto) {
    return this.campaignService.previewAudience(businessId, body.filters);
  }

  @Post(':id/stop-recurrence')
  @Roles('ADMIN')
  stopRecurrence(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.stopRecurrence(businessId, id);
  }

  @Get(':id/variant-stats')
  variantStats(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.getVariantStats(businessId, id);
  }

  @Get(':id/channel-stats')
  channelStats(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.getChannelStats(businessId, id);
  }

  @Get(':id/funnel')
  funnel(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.getFunnelStats(businessId, id);
  }

  @Get(':id/link-stats')
  linkStats(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.getLinkStats(businessId, id);
  }

  @Post(':id/select-winner')
  @Roles('ADMIN')
  selectWinner(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: SelectWinnerDto,
  ) {
    return this.campaignService.selectWinner(businessId, id, body.variantId);
  }

  @Post(':id/clone')
  @Roles('ADMIN')
  clone(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.clone(businessId, id);
  }

  @Post(':id/test-send')
  @Roles('ADMIN')
  testSend(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @Body() body: { email: string },
  ) {
    return this.campaignService.testSend(businessId, id, body.email);
  }

  @Post('estimate-cost')
  @Roles('ADMIN')
  estimateCost(@BusinessId() businessId: string, @Body() body: { filters: any; channel: string }) {
    return this.campaignService.estimateCost(businessId, body.filters, body.channel);
  }
}
