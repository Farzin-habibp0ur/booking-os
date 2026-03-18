import { Module } from '@nestjs/common';
import { CockpitController } from './cockpit.controller';
import { CockpitTasksService } from './cockpit-tasks.service';
import { CockpitTasksContextService } from './cockpit-tasks-context.service';
import { CockpitDetailService } from './cockpit-detail.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [CockpitController],
  providers: [CockpitTasksService, CockpitTasksContextService, CockpitDetailService],
  exports: [CockpitTasksService],
})
export class CockpitModule {}
