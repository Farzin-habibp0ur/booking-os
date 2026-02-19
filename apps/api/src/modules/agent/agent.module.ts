import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentFrameworkService } from './agent-framework.service';
import { AgentSchedulerService } from './agent-scheduler.service';
import { WaitlistAgentService } from './agents/waitlist-agent.service';
import { RetentionAgentService } from './agents/retention-agent.service';
import { DataHygieneAgentService } from './agents/data-hygiene-agent.service';
import { SchedulingOptimizerService } from './agents/scheduling-optimizer.service';
import { QuoteFollowupAgentService } from './agents/quote-followup-agent.service';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { ActionCardModule } from '../action-card/action-card.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [WaitlistModule, ActionCardModule, AvailabilityModule],
  controllers: [AgentController],
  providers: [
    AgentFrameworkService,
    AgentSchedulerService,
    WaitlistAgentService,
    RetentionAgentService,
    DataHygieneAgentService,
    SchedulingOptimizerService,
    QuoteFollowupAgentService,
  ],
  exports: [AgentFrameworkService],
})
export class AgentModule {}
