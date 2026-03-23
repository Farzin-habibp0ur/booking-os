'use client';

import { AgentDashboard } from './components/agent-dashboard';
import { AIActivityFeed } from './components/ai-activity-feed';

export default function AIOverviewPage() {
  return (
    <div className="space-y-6" data-testid="ai-overview">
      {/* System Health + Agent Dashboard */}
      <AgentDashboard />

      {/* Activity Feed */}
      <AIActivityFeed />
    </div>
  );
}
