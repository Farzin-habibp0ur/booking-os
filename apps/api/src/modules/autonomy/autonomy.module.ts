import { Module } from '@nestjs/common';
import { AutonomyController } from './autonomy.controller';
import { AutonomyService } from './autonomy.service';

@Module({
  controllers: [AutonomyController],
  providers: [AutonomyService],
  exports: [AutonomyService],
})
export class AutonomyModule {}
