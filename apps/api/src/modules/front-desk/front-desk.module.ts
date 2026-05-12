import { Module } from '@nestjs/common';
import { FrontDeskController } from './front-desk.controller';
import { FrontDeskService } from './front-desk.service';
import { FrontDeskAttributionService } from './front-desk-attribution.service';

@Module({
  controllers: [FrontDeskController],
  providers: [FrontDeskService, FrontDeskAttributionService],
  exports: [FrontDeskAttributionService],
})
export class FrontDeskModule {}
