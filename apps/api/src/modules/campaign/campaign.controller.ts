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
import { BusinessId } from '../../common/decorators';
import { CampaignService } from './campaign.service';

@Controller('campaigns')
@UseGuards(AuthGuard('jwt'), TenantGuard, RolesGuard)
export class CampaignController {
  constructor(private campaignService: CampaignService) {}

  @Post()
  @Roles('ADMIN')
  create(@BusinessId() businessId: string, @Body() body: any) {
    return this.campaignService.create(businessId, body);
  }

  @Get()
  findAll(@BusinessId() businessId: string, @Query() query: any) {
    return this.campaignService.findAll(businessId, query);
  }

  @Get(':id')
  findById(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.findById(businessId, id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@BusinessId() businessId: string, @Param('id') id: string, @Body() body: any) {
    return this.campaignService.update(businessId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  delete(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.delete(businessId, id);
  }

  @Post(':id/send')
  @Roles('ADMIN')
  send(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.campaignService.sendCampaign(businessId, id);
  }

  @Post(':id/preview')
  previewAudience(@BusinessId() businessId: string, @Body() body: { filters: any }) {
    return this.campaignService.previewAudience(businessId, body.filters);
  }
}
