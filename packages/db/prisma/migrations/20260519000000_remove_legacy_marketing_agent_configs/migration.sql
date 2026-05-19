-- Remove legacy marketing AgentConfig + AgentRun rows.
--
-- The marketing-agent module used CamelCase IDs (e.g. 'BlogWriter') before
-- being renamed to MKT_* prefixed IDs. The customer-facing AgentConfigService
-- filter excludes only the MKT_* IDs, so stale legacy rows leak into the
-- customer dashboard at /ai (showed up as 17 agents on Glow Aesthetic Clinic
-- when only 5 core operational agents should be visible).
--
-- The code filter has been extended to exclude these legacy IDs as a
-- belt-and-suspenders measure; this migration deletes the underlying rows so
-- there is no historical residue.

DELETE FROM "agent_runs"
WHERE "agentType" IN (
  'BlogWriter',
  'SocialCreator',
  'EmailComposer',
  'CaseStudyWriter',
  'VideoScriptWriter',
  'NewsletterComposer',
  'ContentScheduler',
  'ContentPublisher',
  'PerformanceTracker',
  'TrendAnalyzer',
  'ContentCalendar',
  'ContentROI'
);

DELETE FROM "agent_configs"
WHERE "agentType" IN (
  'BlogWriter',
  'SocialCreator',
  'EmailComposer',
  'CaseStudyWriter',
  'VideoScriptWriter',
  'NewsletterComposer',
  'ContentScheduler',
  'ContentPublisher',
  'PerformanceTracker',
  'TrendAnalyzer',
  'ContentCalendar',
  'ContentROI'
);
