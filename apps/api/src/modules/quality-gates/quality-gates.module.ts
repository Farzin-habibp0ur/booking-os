import { Module } from '@nestjs/common';
import { QualityGateController } from './quality-gates.controller';
import { QualityGateService } from './quality-gates.service';

@Module({
  controllers: [QualityGateController],
  providers: [QualityGateService],
  exports: [QualityGateService],
})
export class QualityGateModule {}
