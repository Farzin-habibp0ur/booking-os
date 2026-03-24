import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CampaignController, CampaignUnsubscribeController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { CampaignDispatchService } from './campaign-dispatch.service';
import { SavedSegmentService } from './saved-segment.service';
import { AutomationModule } from '../automation/automation.module';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
    forwardRef(() => AutomationModule),
  ],
  controllers: [CampaignController, CampaignUnsubscribeController],
  providers: [CampaignService, CampaignDispatchService, SavedSegmentService],
  exports: [CampaignService],
})
export class CampaignModule {}
