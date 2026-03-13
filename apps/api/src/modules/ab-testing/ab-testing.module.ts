import { Module } from '@nestjs/common';
import { AbTestingController } from './ab-testing.controller';
import { AbTestingService } from './ab-testing.service';

@Module({
  controllers: [AbTestingController],
  providers: [AbTestingService],
  exports: [AbTestingService],
})
export class AbTestingModule {}
