import { Module } from '@nestjs/common';
import { BusinessReviewController } from './business-review.controller';
import { BusinessReviewService } from './business-review.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [BusinessReviewController],
  providers: [BusinessReviewService],
  exports: [BusinessReviewService],
})
export class BusinessReviewModule {}
