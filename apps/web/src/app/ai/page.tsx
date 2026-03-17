'use client';

import { AgentDashboard } from './components/agent-dashboard';
import { AutonomyOverview } from './components/autonomy-overview';
import { AIActivityFeed } from './components/ai-activity-feed';

export default function AIOverviewPage() {
  return (
    <div className="space-y-6" data-testid="ai-overview">
      {/* System Health + Agent Dashboard */}
      <AgentDashboard />

      {/* Activity Feed + Autonomy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AIActivityFeed />
        </div>
        <div>
          <AutonomyOverview />
        </div>
      </div>
    </div>
  );
}
