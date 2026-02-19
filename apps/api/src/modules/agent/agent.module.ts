import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentFrameworkService } from './agent-framework.service';
import { AgentSchedulerService } from './agent-scheduler.service';

@Module({
  controllers: [AgentController],
  providers: [AgentFrameworkService, AgentSchedulerService],
  exports: [AgentFrameworkService],
})
export class AgentModule {}
