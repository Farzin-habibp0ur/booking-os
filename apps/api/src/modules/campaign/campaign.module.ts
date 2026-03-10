import { Module } from '@nestjs/common';
import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignDispatchService } from './campaign-dispatch.service';
import { SavedSegmentService } from './saved-segment.service';

@Module({
  controllers: [CampaignController],
  providers: [CampaignService, CampaignDispatchService, SavedSegmentService],
  exports: [CampaignService],
})
export class CampaignModule {}
