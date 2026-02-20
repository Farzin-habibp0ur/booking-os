'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  Bot,
  BarChart3,
  Pause,
  Play,
  Sliders,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
} from 'lucide-react';

interface AgentTypeStats {
  agentType: string;
  runs: number;
  completed: number;
  failed: number;
  successRate: number;
  cardsCreated: number;
  helpfulRate: number;
}

interface PerformanceData {
  totalRuns: number;
  successRate: number;
  cardsCreated: number;
  feedbackHelpfulRate: number;
  byAgentType: AgentTypeStats[];
}

interface FunnelData {
  total: number;
  pending: number;
  approved: number;
  dismissed: number;
  executed: number;
  expired: number;
  snoozed: number;
  approvalRate: number;
  executionRate: number;
}

interface FailureItem {
  error: string;
  count: number;
  agentType: string;
  lastSeen: string;
}

interface AbnormalTenant {
  businessId: string;
  businessName: string;
  businessSlug: string;
  totalRuns: number;
  failedRuns: number;
  failureRate: number;
  platformAvgRate: number;
}

interface TenantAgent {
  agentType: string;
  isEnabled: boolean;
  autonomyLevel: string;
  runsLast7d: number;
  successRate: number;
  cardsCreated: number;
}

interface TenantStatus {
  businessId: string;
  businessName: string;
  agents: TenantAgent[];
}

interface PlatformDefault {
  id: string;
  agentType: string;
  maxAutonomyLevel: string;
  defaultEnabled: boolean;
  confidenceThreshold: number;
  requiresReview: boolean;
}

type Tab = 'performance' | 'tenant-controls' | 'platform-defaults';

export default function ConsoleAgentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('performance');
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [failures, setFailures] = useState<FailureItem[]>([]);
  const [abnormalTenants, setAbnormalTenants] = useState<AbnormalTenant[]>([]);
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | null>(null);
  const [platformDefaults, setPlatformDefaults] = useState<PlatformDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantLoading, setTenantLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    action: string;
    onConfirm: (reason: string) => void;
  } | null>(null);
  const [confirmReason, setConfirmReason] = useState('');

  const fetchPerformance = useCallback(async () => {
    try {
      setLoading(true);
      const [perfData, funnelData, failureData, abnormalData] = await Promise.all([
        api.get<PerformanceData>('/admin/agents-console/performance'),
        api.get<FunnelData>('/admin/agents-console/funnel'),
        api.get<FailureItem[]>('/admin/agents-console/failures'),
        api.get<AbnormalTenant[]>('/admin/agents-console/abnormal-tenants'),
      ]);
      setPerformance(perfData);
      setFunnel(funnelData);
      setFailures(failureData);
      setAbnormalTenants(abnormalData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load agent performance data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDefaults = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<PlatformDefault[]>('/admin/agents-console/platform-defaults');
      setPlatformDefaults(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load platform defaults');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'performance') {
      fetchPerformance();
    } else if (activeTab === 'platform-defaults') {
      fetchDefaults();
    }
  }, [activeTab, fetchPerformance, fetchDefaults]);

  const searchTenant = useCallback(async () => {
    if (!tenantSearch.trim()) return;
    try {
      setTenantLoading(true);
      const data = await api.get<TenantStatus>(
        `/admin/agents-console/tenant/${tenantSearch.trim()}`,
      );
      setTenantStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load tenant status');
      setTenantStatus(null);
    } finally {
      setTenantLoading(false);
    }
  }, [tenantSearch]);

  const handlePauseAll = useCallback(
    async (reason: string) => {
      if (!tenantStatus) return;
      try {
        await api.post(`/admin/agents-console/tenant/${tenantStatus.businessId}/pause-all`, {
          reason,
        });
        setConfirmModal(null);
        setConfirmReason('');
        searchTenant();
      } catch (err: any) {
        setError(err.message || 'Failed to pause agents');
      }
    },
    [tenantStatus, searchTenant],
  );

  const handleResumeAll = useCallback(
    async (reason: string) => {
      if (!tenantStatus) return;
      try {
        await api.post(`/admin/agents-console/tenant/${tenantStatus.businessId}/resume-all`, {
          reason,
        });
        setConfirmModal(null);
        setConfirmReason('');
        searchTenant();
      } catch (err: any) {
        setError(err.message || 'Failed to resume agents');
      }
    },
    [tenantStatus, searchTenant],
  );

  const handleUpdateAgent = useCallback(
    async (
      agentType: string,
      data: { isEnabled?: boolean; autonomyLevel?: string },
      reason: string,
    ) => {
      if (!tenantStatus) return;
      try {
        await api.post(
          `/admin/agents-console/tenant/${tenantStatus.businessId}/agent/${agentType}`,
          { ...data, reason },
        );
        setConfirmModal(null);
        setConfirmReason('');
        searchTenant();
      } catch (err: any) {
        setError(err.message || 'Failed to update agent');
      }
    },
    [tenantStatus, searchTenant],
  );

  const handleUpdateDefault = useCallback(
    async (agentType: string, data: Omit<PlatformDefault, 'id' | 'agentType'>) => {
      try {
        await api.put(`/admin/agents-console/platform-defaults/${agentType}`, data);
        fetchDefaults();
      } catch (err: any) {
        setError(err.message || 'Failed to update platform default');
      }
    },
    [fetchDefaults],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'performance', label: 'Performance' },
    { id: 'tenant-controls', label: 'Tenant Controls' },
    { id: 'platform-defaults', label: 'Platform Defaults' },
  ];

  if (loading && activeTab !== 'tenant-controls') {
    return (
      <div className="p-6 md:p-8 max-w-6xl" data-testid="agents-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-32" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
        AI & Agents
      </h1>

      {error && (
        <div
          className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 mb-6 text-red-700 dark:text-red-400"
          data-testid="agents-error"
        >
          {error}
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1"
        data-testid="agents-tabs"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Performance Tab */}
      {activeTab === 'performance' && performance && (
        <div data-testid="performance-tab">
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="kpi-cards">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={14} className="text-lavender-600" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">Runs (7d)</span>
              </div>
              <p
                className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
                data-testid="total-runs"
              >
                {performance.totalRuns}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-sage-600" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Success Rate
                </span>
              </div>
              <p
                className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
                data-testid="success-rate"
              >
                {performance.successRate}%
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={14} className="text-sage-600" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Cards Created
                </span>
              </div>
              <p
                className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
                data-testid="cards-created"
              >
                {performance.cardsCreated}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={14} className="text-lavender-600" />
                <span className="text-xs text-slate-400 uppercase tracking-wider">
                  Helpful Rate
                </span>
              </div>
              <p
                className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
                data-testid="helpful-rate"
              >
                {performance.feedbackHelpfulRate}%
              </p>
            </div>
          </div>

          {/* Performance by Agent Type */}
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
            data-testid="performance-table"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Performance by Agent Type
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-3 pr-4">Agent Type</th>
                    <th className="pb-3 pr-4">Runs</th>
                    <th className="pb-3 pr-4">Completed</th>
                    <th className="pb-3 pr-4">Failed</th>
                    <th className="pb-3 pr-4">Success Rate</th>
                    <th className="pb-3 pr-4">Cards</th>
                    <th className="pb-3">Helpful</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.byAgentType.map((agent) => (
                    <tr
                      key={agent.agentType}
                      className="border-b border-slate-50 dark:border-slate-800/50"
                    >
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                        {agent.agentType}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{agent.runs}</td>
                      <td className="py-3 pr-4 text-sage-600">{agent.completed}</td>
                      <td className="py-3 pr-4 text-red-500">{agent.failed}</td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {agent.successRate}%
                      </td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {agent.cardsCreated}
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">
                        {agent.helpfulRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ActionCard Funnel */}
          {funnel && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
              data-testid="funnel-section"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                ActionCard Funnel
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <span className="text-xs text-slate-400">Total</span>
                  <p className="text-xl font-serif font-bold text-slate-900 dark:text-white">
                    {funnel.total}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Approval Rate</span>
                  <p className="text-xl font-serif font-bold text-sage-600">
                    {funnel.approvalRate}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Execution Rate</span>
                  <p className="text-xl font-serif font-bold text-lavender-600">
                    {funnel.executionRate}%
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Dismissed</span>
                  <p className="text-xl font-serif font-bold text-amber-600">{funnel.dismissed}</p>
                </div>
              </div>
              <div className="flex gap-1 h-6 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {funnel.total > 0 && (
                  <>
                    <div
                      className="bg-amber-200 dark:bg-amber-700"
                      style={{ width: `${(funnel.pending / funnel.total) * 100}%` }}
                      title={`Pending: ${funnel.pending}`}
                    />
                    <div
                      className="bg-sage-300 dark:bg-sage-700"
                      style={{ width: `${(funnel.approved / funnel.total) * 100}%` }}
                      title={`Approved: ${funnel.approved}`}
                    />
                    <div
                      className="bg-sage-500"
                      style={{ width: `${(funnel.executed / funnel.total) * 100}%` }}
                      title={`Executed: ${funnel.executed}`}
                    />
                    <div
                      className="bg-red-300 dark:bg-red-700"
                      style={{ width: `${(funnel.dismissed / funnel.total) * 100}%` }}
                      title={`Dismissed: ${funnel.dismissed}`}
                    />
                    <div
                      className="bg-slate-300 dark:bg-slate-600"
                      style={{
                        width: `${((funnel.expired + funnel.snoozed) / funnel.total) * 100}%`,
                      }}
                      title={`Expired/Snoozed: ${funnel.expired + funnel.snoozed}`}
                    />
                  </>
                )}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-700" /> Pending
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-sage-300 dark:bg-sage-700" /> Approved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-sage-500" /> Executed
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-300 dark:bg-red-700" /> Dismissed
                </span>
              </div>
            </div>
          )}

          {/* Top Failure Reasons */}
          {failures.length > 0 && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-6"
              data-testid="failure-list"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Top Failure Reasons
              </h2>
              <div className="space-y-3">
                {failures.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <XCircle size={16} className="text-red-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {f.error}
                        </p>
                        <p className="text-xs text-slate-500">{f.agentType}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-red-500">{f.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abnormal Tenants */}
          {abnormalTenants.length > 0 && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6"
              data-testid="abnormal-tenants"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Abnormal Tenants
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-3 pr-4">Business</th>
                      <th className="pb-3 pr-4">Total Runs</th>
                      <th className="pb-3 pr-4">Failed</th>
                      <th className="pb-3 pr-4">Failure Rate</th>
                      <th className="pb-3">Platform Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abnormalTenants.map((tenant) => (
                      <tr
                        key={tenant.businessId}
                        className="border-b border-slate-50 dark:border-slate-800/50"
                      >
                        <td className="py-3 pr-4">
                          <Link
                            href={`/console/businesses/${tenant.businessId}`}
                            className="text-sage-600 hover:text-sage-700 font-medium"
                          >
                            {tenant.businessName}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                          {tenant.totalRuns}
                        </td>
                        <td className="py-3 pr-4 text-red-500">{tenant.failedRuns}</td>
                        <td className="py-3 pr-4 text-red-500 font-medium">
                          {tenant.failureRate}%
                        </td>
                        <td className="py-3 text-slate-500">{tenant.platformAvgRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {performance.totalRuns === 0 && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center"
              data-testid="empty-state"
            >
              <Bot size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No agent runs recorded yet</p>
            </div>
          )}
        </div>
      )}

      {/* Tenant Controls Tab */}
      {activeTab === 'tenant-controls' && (
        <div data-testid="tenant-controls-tab">
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchTenant()}
                placeholder="Enter Business ID..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-transparent rounded-xl text-sm focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500"
                data-testid="tenant-search-input"
              />
            </div>
            <button
              onClick={searchTenant}
              className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm font-medium"
              data-testid="search-button"
            >
              Search
            </button>
          </div>

          {tenantLoading && (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
              ))}
            </div>
          )}

          {tenantStatus && !tenantLoading && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {tenantStatus.businessName}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setConfirmModal({
                        action: 'Pause All Agents',
                        onConfirm: handlePauseAll,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-xl text-sm font-medium hover:bg-amber-100"
                    data-testid="pause-all-button"
                  >
                    <Pause size={14} /> Pause All
                  </button>
                  <button
                    onClick={() =>
                      setConfirmModal({
                        action: 'Resume All Agents',
                        onConfirm: handleResumeAll,
                      })
                    }
                    className="flex items-center gap-2 px-3 py-1.5 bg-sage-50 dark:bg-sage-900/20 text-sage-700 dark:text-sage-400 rounded-xl text-sm font-medium hover:bg-sage-100"
                    data-testid="resume-all-button"
                  >
                    <Play size={14} /> Resume All
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {tenantStatus.agents.map((agent) => (
                  <div
                    key={agent.agentType}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4"
                    data-testid={`agent-card-${agent.agentType}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Bot size={16} className="text-lavender-600" />
                        <span className="font-medium text-slate-900 dark:text-white">
                          {agent.agentType}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            agent.isEnabled
                              ? 'bg-sage-50 text-sage-700 dark:bg-sage-900/20 dark:text-sage-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                          }`}
                        >
                          {agent.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          value={agent.autonomyLevel}
                          onChange={(e) =>
                            setConfirmModal({
                              action: `Update ${agent.agentType} autonomy`,
                              onConfirm: (reason) =>
                                handleUpdateAgent(
                                  agent.agentType,
                                  { autonomyLevel: e.target.value },
                                  reason,
                                ),
                            })
                          }
                          className="text-sm bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 border-transparent"
                          data-testid={`autonomy-select-${agent.agentType}`}
                        >
                          <option value="REQUIRE_APPROVAL">Require Approval</option>
                          <option value="SUGGEST">Suggest</option>
                          <option value="AUTO">Auto</option>
                        </select>
                        <button
                          onClick={() =>
                            setConfirmModal({
                              action: `${agent.isEnabled ? 'Disable' : 'Enable'} ${agent.agentType}`,
                              onConfirm: (reason) =>
                                handleUpdateAgent(
                                  agent.agentType,
                                  { isEnabled: !agent.isEnabled },
                                  reason,
                                ),
                            })
                          }
                          className={`text-xs px-3 py-1 rounded-lg font-medium ${
                            agent.isEnabled
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                          }`}
                        >
                          {agent.isEnabled ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-6 text-xs text-slate-500">
                      <span>
                        Runs (7d):{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {agent.runsLast7d}
                        </span>
                      </span>
                      <span>
                        Success:{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {agent.successRate}%
                        </span>
                      </span>
                      <span>
                        Cards:{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {agent.cardsCreated}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Platform Defaults Tab */}
      {activeTab === 'platform-defaults' && (
        <div data-testid="platform-defaults-tab">
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6"
            data-testid="defaults-table"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Platform Agent Defaults
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="pb-3 pr-4">Agent Type</th>
                    <th className="pb-3 pr-4">Max Autonomy</th>
                    <th className="pb-3 pr-4">Default Enabled</th>
                    <th className="pb-3 pr-4">Confidence</th>
                    <th className="pb-3 pr-4">Requires Review</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {platformDefaults.map((def) => (
                    <DefaultRow key={def.agentType} default_={def} onSave={handleUpdateDefault} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          data-testid="confirm-modal"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {confirmModal.action}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              This is a high-risk action. Please provide a reason.
            </p>
            <textarea
              value={confirmReason}
              onChange={(e) => setConfirmReason(e.target.value)}
              placeholder="Reason for this action..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm mb-4 border-transparent focus:ring-2 focus:ring-sage-500"
              rows={3}
              data-testid="confirm-reason-input"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setConfirmModal(null);
                  setConfirmReason('');
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmReason.trim() && confirmModal.onConfirm(confirmReason.trim())}
                disabled={!confirmReason.trim()}
                className="px-4 py-2 bg-sage-600 hover:bg-sage-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-medium"
                data-testid="confirm-action-button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DefaultRow({
  default_,
  onSave,
}: {
  default_: PlatformDefault;
  onSave: (agentType: string, data: any) => void;
}) {
  const [maxAutonomy, setMaxAutonomy] = useState(default_.maxAutonomyLevel);
  const [enabled, setEnabled] = useState(default_.defaultEnabled);
  const [confidence, setConfidence] = useState(default_.confidenceThreshold);
  const [review, setReview] = useState(default_.requiresReview);
  const [dirty, setDirty] = useState(false);

  const handleChange = (setter: (v: any) => void, value: any) => {
    setter(value);
    setDirty(true);
  };

  return (
    <tr
      className="border-b border-slate-50 dark:border-slate-800/50"
      data-testid={`default-row-${default_.agentType}`}
    >
      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{default_.agentType}</td>
      <td className="py-3 pr-4">
        <select
          value={maxAutonomy}
          onChange={(e) => handleChange(setMaxAutonomy, e.target.value)}
          className="text-sm bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 border-transparent"
        >
          <option value="REQUIRE_APPROVAL">Require Approval</option>
          <option value="SUGGEST">Suggest</option>
          <option value="AUTO">Auto</option>
        </select>
      </td>
      <td className="py-3 pr-4">
        <button
          onClick={() => handleChange(setEnabled, !enabled)}
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            enabled ? 'bg-sage-50 text-sage-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {enabled ? 'Yes' : 'No'}
        </button>
      </td>
      <td className="py-3 pr-4">
        <input
          type="number"
          value={confidence}
          onChange={(e) => handleChange(setConfidence, parseFloat(e.target.value) || 0)}
          min={0}
          max={1}
          step={0.05}
          className="w-20 text-sm bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 border-transparent"
        />
      </td>
      <td className="py-3 pr-4">
        <button
          onClick={() => handleChange(setReview, !review)}
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            review ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {review ? 'Yes' : 'No'}
        </button>
      </td>
      <td className="py-3">
        {dirty && (
          <button
            onClick={() => {
              onSave(default_.agentType, {
                maxAutonomyLevel: maxAutonomy,
                defaultEnabled: enabled,
                confidenceThreshold: confidence,
                requiresReview: review,
              });
              setDirty(false);
            }}
            className="text-xs px-3 py-1 bg-sage-600 text-white rounded-lg hover:bg-sage-700 font-medium"
            data-testid={`save-default-${default_.agentType}`}
          >
            Save
          </button>
        )}
      </td>
    </tr>
  );
}
