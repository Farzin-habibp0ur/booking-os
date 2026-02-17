import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { AutomationExecutorService } from './automation-executor.service';

@Module({
  controllers: [AutomationController],
  providers: [AutomationService, AutomationExecutorService],
  exports: [AutomationService],
})
export class AutomationModule {}
