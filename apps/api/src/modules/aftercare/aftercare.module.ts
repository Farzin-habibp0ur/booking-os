import { Module } from '@nestjs/common';
import { AftercareController } from './aftercare.controller';
import { AftercareService } from './aftercare.service';

@Module({
  controllers: [AftercareController],
  providers: [AftercareService],
  exports: [AftercareService],
})
export class AftercareModule {}
