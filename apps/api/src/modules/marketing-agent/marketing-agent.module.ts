import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AiModule } from '../ai/ai.module';
import { ContentQueueModule } from '../content-queue/content-queue.module';
import { MarketingAgentService } from './marketing-agent.service';
import { BlogWriterAgentService } from './agents/blog-writer-agent.service';
import { SocialCreatorAgentService } from './agents/social-creator-agent.service';
import { EmailComposerAgentService } from './agents/email-composer-agent.service';
import { CaseStudyAgentService } from './agents/case-study-agent.service';
import { VideoScriptAgentService } from './agents/video-script-agent.service';
import { NewsletterAgentService } from './agents/newsletter-agent.service';
import { ContentSchedulerAgentService } from './agents/content-scheduler-agent.service';
import { ContentPublisherAgentService } from './agents/content-publisher-agent.service';
import { PerformanceTrackerAgentService } from './agents/performance-tracker-agent.service';
import { TrendAnalyzerAgentService } from './agents/trend-analyzer-agent.service';
import { ContentCalendarAgentService } from './agents/content-calendar-agent.service';
import { ContentROIAgentService } from './agents/content-roi-agent.service';

@Module({
  imports: [AgentModule, AiModule, ContentQueueModule],
  providers: [
    MarketingAgentService,
    BlogWriterAgentService,
    SocialCreatorAgentService,
    EmailComposerAgentService,
    CaseStudyAgentService,
    VideoScriptAgentService,
    NewsletterAgentService,
    ContentSchedulerAgentService,
    ContentPublisherAgentService,
    PerformanceTrackerAgentService,
    TrendAnalyzerAgentService,
    ContentCalendarAgentService,
    ContentROIAgentService,
  ],
})
export class MarketingAgentModule {}
