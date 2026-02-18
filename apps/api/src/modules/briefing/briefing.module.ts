import { Module } from '@nestjs/common';
import { BriefingController } from './briefing.controller';
import { BriefingService } from './briefing.service';
import { OpportunityDetectorService } from './opportunity-detector.service';
import { ActionCardModule } from '../action-card/action-card.module';

@Module({
  imports: [ActionCardModule],
  controllers: [BriefingController],
  providers: [BriefingService, OpportunityDetectorService],
  exports: [BriefingService, OpportunityDetectorService],
})
export class BriefingModule {}
