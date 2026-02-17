import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignDispatchService } from './campaign-dispatch.service';

@Module({
  controllers: [CampaignController],
  providers: [CampaignService, CampaignDispatchService],
  exports: [CampaignService],
})
export class CampaignModule {}
