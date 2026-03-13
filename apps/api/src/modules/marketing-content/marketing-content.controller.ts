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
import { TenantGuard } from '../../common/tenant.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { MarketingContentService } from './marketing-content.service';
import {
  CreateContentDraftDto,
  UpdateContentDraftDto,
  ReviewContentDraftDto,
  BulkReviewDto,
  QueryContentDraftsDto,
} from './dto';

@Controller('marketing/content')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class MarketingContentController {
  constructor(private readonly service: MarketingContentService) {}

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@BusinessId() businessId: string, @Body() body: CreateContentDraftDto) {
    return this.service.create(businessId, body);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: QueryContentDraftsDto) {
    return this.service.findAll(businessId, query);
  }

  @Get('stats')
  getStats(@BusinessId() businessId: string) {
    return this.service.getPipelineStats(businessId);
  }

  @Get('pillar-balance')
  getPillarBalance(@BusinessId() businessId: string) {
    return this.service.getPillarBalance(businessId);
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

  @Post(':id/review')
  @Roles('OWNER', 'ADMIN')
  review(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: ReviewContentDraftDto,
  ) {
    return this.service.review(businessId, id, user.id, body);
  }

  @Post('bulk-review')
  @Roles('OWNER', 'ADMIN')
  bulkReview(
    @BusinessId() businessId: string,
    @CurrentUser() user: any,
    @Body() body: BulkReviewDto,
  ) {
    return this.service.bulkReview(businessId, user.id, body);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  remove(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.service.remove(businessId, id);
  }
}
