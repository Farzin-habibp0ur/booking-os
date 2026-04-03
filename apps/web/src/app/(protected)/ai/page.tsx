'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AIValueKPIs } from './components/ai-value-kpis';
import { AgentDashboard } from './components/agent-dashboard';
import { AIGuardrails } from './components/ai-guardrails';
import { PendingDraftsCard } from './components/pending-drafts-card';
import { AIActivityFeed } from './components/ai-activity-feed';
import { AISetupWizard } from './components/ai-setup-wizard';

const SETUP_DISMISSED_KEY = 'bookingos:ai-setup-dismissed';

export default function AIOverviewPage() {
  const [settings, setSettings] = useState<{ enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = () => {
    api
      .get<{ enabled: boolean }>('/ai/settings')
      .then((data) => setSettings(data))
      .catch(() => setSettings({ enabled: true }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (!loading && settings && !settings.enabled) {
    const dismissed = typeof window !== 'undefined' && localStorage.getItem(SETUP_DISMISSED_KEY);
    if (!dismissed) {
      return (
        <div className="py-8">
          <AISetupWizard onComplete={() => loadSettings()} />
        </div>
      );
    }
  }

  return (
    <div className="space-y-6" data-testid="ai-overview">
      {/* Business Impact KPIs */}
      <AIValueKPIs />

      {/* Two-column: Guardrails + Pending Drafts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIGuardrails />
        <PendingDraftsCard />
      </div>

      {/* Agent Health Grid */}
      <AgentDashboard />

      {/* Activity Feed */}
      <AIActivityFeed />
    </div>
  );
}
