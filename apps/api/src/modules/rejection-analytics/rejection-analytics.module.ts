import { Module } from '@nestjs/common';
import { RejectionAnalyticsController } from './rejection-analytics.controller';
import { RejectionAnalyticsService } from './rejection-analytics.service';

@Module({
  controllers: [RejectionAnalyticsController],
  providers: [RejectionAnalyticsService],
  exports: [RejectionAnalyticsService],
})
export class RejectionAnalyticsModule {}
