import { Module } from '@nestjs/common';
import { AutonomySettingsController } from './autonomy-settings.controller';
import { AutonomySettingsService } from './autonomy-settings.service';

@Module({
  controllers: [AutonomySettingsController],
  providers: [AutonomySettingsService],
  exports: [AutonomySettingsService],
})
export class AutonomySettingsModule {}
