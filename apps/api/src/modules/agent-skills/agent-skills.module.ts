import { Module } from '@nestjs/common';
import { AgentSkillsController } from './agent-skills.controller';
import { AgentSkillsService } from './agent-skills.service';

@Module({
  controllers: [AgentSkillsController],
  providers: [AgentSkillsService],
  exports: [AgentSkillsService],
})
export class AgentSkillsModule {}
