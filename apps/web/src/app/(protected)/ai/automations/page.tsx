'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import {
  Zap,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Play,
  Search,
  X,
  ShieldCheck,
  Clock,
  Users,
  Workflow,
  Pencil,
  Copy,
  Download,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import TooltipNudge from '@/components/tooltip-nudge';
import { PlaybookCard } from './components/playbook-card';
import { DryRunModal } from './components/dry-run-modal';
import { UpgradeNudge } from '@/components/upgrade-nudge';
import { usePlan } from '@/lib/use-plan';
import { useSocket } from '@/lib/use-socket';
import { getTriggerLabel, getActionLabel, TRIGGER_LABELS } from '@/lib/automation-labels';
import { AutomationExplainer } from '@/components/automation-explainer';
import React from 'react';

type Tab = 'playbooks' | 'rules' | 'logs';

const OUTCOME_OPTIONS = ['SENT', 'SKIPPED', 'FAILED'] as const;

// FIX-18: Triggers/actions that are not yet fully implemented.
// Keep these arrays empty when the feature is live; add an entry to surface a warning in the UI.
const UNIMPLEMENTED_TRIGGERS: string[] = [];
const UNIMPLEMENTED_ACTIONS: string[] = [];

/** Format "22:00" → "10:00 PM" */
function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export default function AutomationsPage() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('playbooks');
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [logSearch, setLogSearch] = useState('');
  const [logOutcome, setLogOutcome] = useState('');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize] = useState(25);
  const [realtimeEvents, setRealtimeEvents] = useState<Record<string, Date>>({});
  const [safetyDefaults, setSafetyDefaults] = useState<any>(null);
  const [editingSafety, setEditingSafety] = useState(false);
  const [safetyForm, setSafetyForm] = useState({
    quietStart: '',
    quietEnd: '',
    maxPerCustomerPerDay: '',
  });
  const router = useRouter();
  const { toast } = useToast();
  const plan = usePlan();

  // UX-gap-2: Real-time automation execution events
  useSocket({
    'automation:executed': (data: { ruleId: string; timestamp: string }) => {
      setRealtimeEvents((prev) => ({ ...prev, [data.ruleId]: new Date(data.timestamp) }));
    },
  });

  const loadPlaybooks = () =>
    api
      .get<any>('/automations/playbooks')
      .then(setPlaybooks)
      .catch((err: any) => toast(err.message || 'Failed to load playbooks', 'error'));
  const loadRules = () =>
    api
      .get<any>('/automations/rules')
      .then((r) => setRules(Array.isArray(r) ? r : []))
      .catch((err: any) => toast(err.message || 'Failed to load rules', 'error'));

  const loadLogs = useCallback(
    (opts?: {
      search?: string;
      outcome?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
    }) => {
      const currentPage = opts?.page ?? logPage;
      const params = new URLSearchParams({
        pageSize: String(logPageSize),
        skip: String((currentPage - 1) * logPageSize),
      });
      const s = opts?.search ?? logSearch;
      const o = opts?.outcome ?? logOutcome;
      const df = opts?.dateFrom ?? logDateFrom;
      const dt = opts?.dateTo ?? logDateTo;
      if (s) params.set('search', s);
      if (o) params.set('outcome', o);
      if (df) params.set('dateFrom', df);
      if (dt) params.set('dateTo', dt);
      return api
        .get<any>(`/automations/logs?${params.toString()}`)
        .then(setLogs)
        .catch((err: any) => toast(err.message || 'Failed to load activity logs', 'error'));
    },
    [logSearch, logOutcome, logDateFrom, logDateTo, logPage, logPageSize, toast],
  );

  useEffect(() => {
    setMounted(true);
    setLoading(true);
    Promise.all([
      loadPlaybooks(),
      loadRules(),
      loadLogs({}),
      api
        .get('/automations/safety-defaults')
        .then(setSafetyDefaults)
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleTogglePlaybook = async (playbookId: string) => {
    try {
      await api.post(`/automations/playbooks/${playbookId}/toggle`);
      loadPlaybooks();
    } catch (err: any) {
      toast(err.message || 'Failed to toggle playbook', 'error');
    }
  };

  const handleToggleRule = async (rule: any) => {
    try {
      await api.patch(`/automations/rules/${rule.id}`, { isActive: !rule.isActive });
      loadRules();
    } catch (err: any) {
      toast(err.message || 'Failed to toggle rule', 'error');
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteTarget) return;
    try {
      await api.del(`/automations/rules/${deleteTarget.id}`);
      loadRules();
      toast('Rule deleted', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete rule', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDuplicateRule = async (ruleId: string) => {
    try {
      await api.post(`/automations/rules/${ruleId}/duplicate`);
      loadRules();
      toast('Rule duplicated', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to duplicate rule', 'error');
    }
  };

  const handleSaveSafetyDefaults = async () => {
    try {
      const body: Record<string, unknown> = {};
      if (safetyForm.quietStart) body.quietStart = safetyForm.quietStart;
      if (safetyForm.quietEnd) body.quietEnd = safetyForm.quietEnd;
      if (safetyForm.maxPerCustomerPerDay)
        body.maxPerCustomerPerDay = Number(safetyForm.maxPerCustomerPerDay);
      const result = await api.patch('/automations/safety-defaults', body);
      setSafetyDefaults(result);
      setEditingSafety(false);
      toast('Safety defaults saved', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to save defaults', 'error');
    }
  };

  const handleTestRule = async (id: string) => {
    setDryRunLoading(true);
    try {
      const result = await api.post<any>(`/automations/rules/${id}/test`);
      setDryRunResult(result);
    } catch (err: any) {
      toast(err.message || 'Failed to test rule', 'error');
    } finally {
      setDryRunLoading(false);
    }
  };

  const handleLogFilterApply = () => {
    loadLogs({ search: logSearch, outcome: logOutcome, dateFrom: logDateFrom, dateTo: logDateTo });
  };

  const handleClearFilters = () => {
    setLogSearch('');
    setLogOutcome('');
    setLogDateFrom('');
    setLogDateTo('');
    setLogPage(1);
    loadLogs({ search: '', outcome: '', dateFrom: '', dateTo: '', page: 1 });
  };

  const hasActiveFilters = logSearch || logOutcome || logDateFrom || logDateTo;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'playbooks', label: 'Playbooks' },
    { key: 'rules', label: 'Custom Rules' },
    { key: 'logs', label: 'Activity Log' },
  ];

  return (
    <div className="p-6" data-tour-target="automations-list">
      <AutomationExplainer />
      <TooltipNudge
        id="automations-intro"
        title="Automate your workflow"
        description="Enable pre-built playbooks or create custom rules to automatically send messages, tag customers, or assign staff based on booking events."
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Automations</h1>
        {tab === 'rules' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/ai/automations/builder')}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              data-testid="visual-builder-link"
            >
              <Workflow size={16} />
              Visual Builder
            </button>
            <button
              onClick={() => router.push('/ai/automations/new')}
              className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
            >
              <Plus size={16} />
              Create Rule
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-lg transition-colors',
              tab === t.key
                ? 'bg-white text-slate-900 shadow-sm font-medium'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <UpgradeNudge
        current={rules.length + playbooks.filter((p: any) => p.isActive).length}
        plan={plan}
        resource="automations"
        resourceLabel="automations"
      />

      {/* Safety Controls Summary */}
      {mounted && (tab === 'playbooks' || tab === 'rules') && (
        <div
          className="mb-4 bg-white rounded-2xl shadow-soft p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          data-testid="safety-controls-panel"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-sage-600" />
            <span className="text-sm font-medium text-slate-800">Safety Controls</span>
            <button
              onClick={() => {
                if (!editingSafety) {
                  setSafetyForm({
                    quietStart: safetyDefaults?.quietStart || '',
                    quietEnd: safetyDefaults?.quietEnd || '',
                    maxPerCustomerPerDay: safetyDefaults?.maxPerCustomerPerDay?.toString() || '',
                  });
                }
                setEditingSafety(!editingSafety);
              }}
              className="ml-auto text-slate-400 hover:text-sage-600 p-1"
              title="Configure Safety Controls"
              data-testid="safety-edit-btn"
            >
              <Settings size={14} />
            </button>
          </div>
          {editingSafety && (
            <div className="w-full flex flex-col sm:flex-row gap-3 mt-2 p-3 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Quiet start</label>
                <input
                  type="time"
                  value={safetyForm.quietStart}
                  onChange={(e) => setSafetyForm((f) => ({ ...f, quietStart: e.target.value }))}
                  className="px-2 py-1.5 bg-white border-transparent rounded-lg text-xs focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Quiet end</label>
                <input
                  type="time"
                  value={safetyForm.quietEnd}
                  onChange={(e) => setSafetyForm((f) => ({ ...f, quietEnd: e.target.value }))}
                  className="px-2 py-1.5 bg-white border-transparent rounded-lg text-xs focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Max/day</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={safetyForm.maxPerCustomerPerDay}
                  onChange={(e) =>
                    setSafetyForm((f) => ({ ...f, maxPerCustomerPerDay: e.target.value }))
                  }
                  className="w-16 px-2 py-1.5 bg-white border-transparent rounded-lg text-xs focus:ring-2 focus:ring-sage-500"
                />
              </div>
              <button
                onClick={handleSaveSafetyDefaults}
                className="px-3 py-1.5 bg-sage-600 text-white rounded-lg text-xs hover:bg-sage-700"
              >
                Save
              </button>
              <button
                onClick={() => setEditingSafety(false)}
                className="px-3 py-1.5 text-slate-500 text-xs hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs text-slate-600">Quiet hours:</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sage-50 text-sage-700">
                {(() => {
                  const allRules = [...playbooks, ...rules];
                  const withQuiet = allRules.filter((r: any) => r.quietStart && r.quietEnd);
                  if (withQuiet.length === 0) return 'Not configured';
                  const starts = new Set(withQuiet.map((r: any) => r.quietStart));
                  const ends = new Set(withQuiet.map((r: any) => r.quietEnd));
                  if (starts.size === 1 && ends.size === 1) {
                    return `Active (${formatTime12h(withQuiet[0].quietStart)} – ${formatTime12h(withQuiet[0].quietEnd)})`;
                  }
                  return 'Active (varies by rule)';
                })()}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-slate-400" />
              <span className="text-xs text-slate-600">Frequency cap:</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sage-50 text-sage-700">
                {(() => {
                  const allRules = [...playbooks, ...rules];
                  const caps = allRules
                    .map((r: any) => r.maxPerCustomerPerDay)
                    .filter((c: any) => c != null && c > 0);
                  if (caps.length === 0) return '3 per customer/day';
                  const minCap = Math.min(...caps);
                  return `${minCap} per customer/day`;
                })()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Playbooks */}
      {tab === 'playbooks' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-soft p-5 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-full mb-4" />
                  <div className="h-8 bg-slate-100 rounded w-24" />
                </div>
              ))
            : playbooks.map((pb) => (
                <PlaybookCard
                  key={pb.playbook || pb.id}
                  playbook={pb}
                  onToggle={handleTogglePlaybook}
                />
              ))}
        </div>
      )}

      {/* FIX-18: Warn about rules using unimplemented triggers or actions */}
      {tab === 'rules' &&
        !loading &&
        rules.some(
          (r) =>
            UNIMPLEMENTED_TRIGGERS.includes(r.trigger) ||
            (Array.isArray(r.actions) &&
              r.actions.some((a: any) => UNIMPLEMENTED_ACTIONS.includes(a.type))),
        ) && (
          <div
            className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2"
            data-testid="unimplemented-warning"
            role="alert"
          >
            <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
            <span>
              One or more of your rules use triggers or actions that are not yet fully implemented.
              These rules will be skipped at runtime until the feature is available.
            </span>
          </div>
        )}

      {/* Custom Rules */}
      {tab === 'rules' && (
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    Name
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    Trigger
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    Last Run
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    Safety
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                  : rules
                      .filter((r) => !r.playbook)
                      .map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{rule.name}</td>
                          <td className="p-3 text-sm text-slate-600">
                            <div className="flex items-center gap-1.5">
                              {TRIGGER_LABELS[rule.trigger]?.icon &&
                                React.createElement(TRIGGER_LABELS[rule.trigger].icon, {
                                  size: 14,
                                  className: 'text-slate-400',
                                })}
                              {getTriggerLabel(rule.trigger)}
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={cn(
                                'text-xs px-2 py-0.5 rounded-full',
                                rule.isActive
                                  ? 'bg-sage-50 text-sage-700'
                                  : 'bg-slate-100 text-slate-500',
                              )}
                            >
                              {rule.isActive ? 'Active' : 'Off'}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-slate-500">
                            {realtimeEvents[rule.id]
                              ? new Date(realtimeEvents[rule.id]).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Never'}
                          </td>
                          <td className="p-3" data-testid={`safety-col-${rule.id}`}>
                            <div className="flex items-center gap-1">
                              {rule.quietStart && rule.quietEnd ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-sage-50 text-sage-700">
                                  Quiet {rule.quietStart}–{rule.quietEnd}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Default</span>
                              )}
                              {rule.maxPerCustomerPerDay && rule.maxPerCustomerPerDay !== 3 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {rule.maxPerCustomerPerDay}/day
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleToggleRule(rule)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                              >
                                {rule.isActive ? (
                                  <ToggleRight size={16} />
                                ) : (
                                  <ToggleLeft size={16} />
                                )}
                              </button>
                              <button
                                onClick={() =>
                                  router.push(`/automations/builder?ruleId=${rule.id}`)
                                }
                                className="text-slate-400 hover:text-sage-600 p-1"
                                title="Edit in Builder"
                                data-testid={`edit-builder-${rule.id}`}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDuplicateRule(rule.id)}
                                className="text-slate-400 hover:text-sage-600 p-1"
                                title="Duplicate"
                                data-testid={`duplicate-rule-${rule.id}`}
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => handleTestRule(rule.id)}
                                className="text-slate-400 hover:text-sage-600 p-1"
                                data-testid={`test-rule-${rule.id}`}
                              >
                                <Play size={16} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ id: rule.id, name: rule.name })}
                                className="text-slate-400 hover:text-red-500 p-1"
                                data-testid={`delete-rule-${rule.id}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
              </tbody>
            </table>
          </div>
          {!loading && rules.filter((r) => !r.playbook).length === 0 && (
            <EmptyState
              icon={Zap}
              title="No custom rules"
              description="Create automation rules to trigger actions based on booking events."
            />
          )}
        </div>
      )}

      {/* Activity Log */}
      {tab === 'logs' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-soft p-4" data-testid="log-filters">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogFilterApply()}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
                  data-testid="log-search-input"
                />
              </div>
              <div className="flex gap-1.5 items-center flex-wrap">
                {OUTCOME_OPTIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => {
                      const next = logOutcome === o ? '' : o;
                      setLogOutcome(next);
                      loadLogs({
                        search: logSearch,
                        outcome: next,
                        dateFrom: logDateFrom,
                        dateTo: logDateTo,
                      });
                    }}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg transition-colors',
                      logOutcome === o
                        ? o === 'SENT'
                          ? 'bg-sage-100 text-sage-700 font-medium'
                          : o === 'SKIPPED'
                            ? 'bg-amber-100 text-amber-700 font-medium'
                            : 'bg-red-100 text-red-700 font-medium'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                    )}
                    data-testid={`outcome-filter-${o}`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">From</label>
                <input
                  type="date"
                  value={logDateFrom}
                  onChange={(e) => setLogDateFrom(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 border-transparent rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-sage-500"
                  data-testid="log-date-from"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">To</label>
                <input
                  type="date"
                  value={logDateTo}
                  onChange={(e) => setLogDateTo(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 border-transparent rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-sage-500"
                  data-testid="log-date-to"
                />
              </div>
              <button
                onClick={handleLogFilterApply}
                className="px-3 py-1.5 bg-sage-600 text-white rounded-lg text-xs hover:bg-sage-700 transition-colors"
                data-testid="apply-log-filters"
              >
                Apply
              </button>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:text-slate-700 text-xs"
                  data-testid="clear-log-filters"
                >
                  <X size={12} />
                  Clear
                </button>
              )}
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (logSearch) params.set('search', logSearch);
                  if (logOutcome) params.set('outcome', logOutcome);
                  if (logDateFrom) params.set('dateFrom', logDateFrom);
                  if (logDateTo) params.set('dateTo', logDateTo);
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
                  window.open(`${apiUrl}/automations/activity/export?${params.toString()}`);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-slate-600 hover:text-slate-800 text-xs"
                data-testid="export-csv-btn"
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Log Table */}
          <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                      Rule
                    </th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                      Action
                    </th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                      Outcome
                    </th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading
                    ? Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)
                    : logs.data.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{log.rule?.name || '—'}</td>
                          <td className="p-3 text-sm text-slate-600">
                            {getActionLabel(log.action)}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'text-xs px-2 py-0.5 rounded-full',
                                  log.outcome === 'SENT'
                                    ? 'bg-sage-50 text-sage-700'
                                    : log.outcome === 'SKIPPED'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-red-50 text-red-700',
                                )}
                              >
                                {log.outcome === 'SENT'
                                  ? '✓'
                                  : log.outcome === 'SKIPPED'
                                    ? '⏭'
                                    : '✗'}{' '}
                                {log.outcome}
                              </span>
                              {/* Step progress dots for multi-step automations */}
                              {log.rule?.steps?.length > 1 && (
                                <div
                                  className="flex items-center gap-0.5"
                                  aria-label="Step progress"
                                >
                                  {log.rule.steps.map((step: any, idx: number) => {
                                    const isLast = idx === log.rule.steps.length - 1;
                                    const dotClass = isLast
                                      ? log.outcome === 'SENT'
                                        ? 'bg-sage-500'
                                        : log.outcome === 'SKIPPED'
                                          ? 'bg-amber-400'
                                          : 'bg-red-500'
                                      : 'bg-sage-500';
                                    return (
                                      <span
                                        key={step.id}
                                        className={cn('w-2 h-2 rounded-full', dotClass)}
                                        title={step.type}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {log.reason && (
                              <span className="text-xs text-slate-400 ml-1">{log.reason}</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-slate-500">
                            {new Date(log.createdAt).toLocaleString('en-US', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {!loading && logs.data.length === 0 && (
              <EmptyState
                icon={Zap}
                title="No activity yet"
                description="Automation logs will appear here once rules start executing."
              />
            )}
            {/* Pagination */}
            {logs.total > logPageSize && (
              <div className="flex items-center justify-between p-3 border-t">
                <span className="text-xs text-slate-500">
                  Showing {(logPage - 1) * logPageSize + 1}–
                  {Math.min(logPage * logPageSize, logs.total)} of {logs.total}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const prev = Math.max(1, logPage - 1);
                      setLogPage(prev);
                      loadLogs({ page: prev });
                    }}
                    disabled={logPage === 1}
                    className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                  >
                    <ChevronLeft size={12} /> Previous
                  </button>
                  <button
                    onClick={() => {
                      const next = logPage + 1;
                      setLogPage(next);
                      loadLogs({ page: next });
                    }}
                    disabled={logPage * logPageSize >= logs.total}
                    className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                  >
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Rule</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>? This
              action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRule}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                data-testid="confirm-delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dry Run Modal */}
      {dryRunResult && <DryRunModal result={dryRunResult} onClose={() => setDryRunResult(null)} />}
    </div>
  );
}
