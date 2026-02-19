import { Module } from '@nestjs/common';
import { AgentFeedbackController } from './agent-feedback.controller';
import { AgentFeedbackService } from './agent-feedback.service';

@Module({
  controllers: [AgentFeedbackController],
  providers: [AgentFeedbackService],
  exports: [AgentFeedbackService],
})
export class AgentFeedbackModule {}
