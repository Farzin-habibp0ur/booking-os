import { Module } from '@nestjs/common';
import { MarketingContentController } from './marketing-content.controller';
import { MarketingContentService } from './marketing-content.service';

@Module({
  controllers: [MarketingContentController],
  providers: [MarketingContentService],
  exports: [MarketingContentService],
})
export class MarketingContentModule {}
