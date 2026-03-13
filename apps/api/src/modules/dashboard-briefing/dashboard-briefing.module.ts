import { Module } from '@nestjs/common';
import { DashboardBriefingController } from './dashboard-briefing.controller';
import { DashboardBriefingService } from './dashboard-briefing.service';

@Module({
  controllers: [DashboardBriefingController],
  providers: [DashboardBriefingService],
  exports: [DashboardBriefingService],
})
export class DashboardBriefingModule {}
