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
} from 'lucide-react';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import TooltipNudge from '@/components/tooltip-nudge';
import { PlaybookCard } from './components/playbook-card';
import { DryRunModal } from './components/dry-run-modal';

type Tab = 'playbooks' | 'rules' | 'logs';

const OUTCOME_OPTIONS = ['SENT', 'SKIPPED', 'FAILED'] as const;

export default function AutomationsPage() {
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
  const router = useRouter();
  const { toast } = useToast();

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
    (opts?: { search?: string; outcome?: string; dateFrom?: string; dateTo?: string }) => {
      const params = new URLSearchParams({ pageSize: '50' });
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
    [logSearch, logOutcome, logDateFrom, logDateTo, toast],
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPlaybooks(), loadRules(), loadLogs({})]).finally(() => setLoading(false));
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

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await api.del(`/automations/rules/${id}`);
      loadRules();
    } catch (err: any) {
      toast(err.message || 'Failed to delete rule', 'error');
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
    loadLogs({ search: '', outcome: '', dateFrom: '', dateTo: '' });
  };

  const hasActiveFilters = logSearch || logOutcome || logDateFrom || logDateTo;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'playbooks', label: 'Playbooks' },
    { key: 'rules', label: 'Custom Rules' },
    { key: 'logs', label: 'Activity Log' },
  ];

  return (
    <div className="p-6" data-tour-target="automations-list">
      <TooltipNudge
        id="automations-intro"
        title="Automate your workflow"
        description="Enable pre-built playbooks or create custom rules to automatically send messages, tag customers, or assign staff based on booking events."
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Automations</h1>
        {tab === 'rules' && (
          <button
            onClick={() => router.push('/automations/new')}
            className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
          >
            <Plus size={16} />
            Create Rule
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
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

      {/* Safety Controls Summary */}
      {(tab === 'playbooks' || tab === 'rules') && (
        <div
          className="mb-4 bg-white rounded-2xl shadow-soft p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          data-testid="safety-controls-panel"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-sage-600" />
            <span className="text-sm font-medium text-slate-800">Safety Controls</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs text-slate-600">Quiet hours:</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sage-50 text-sage-700">
                Active (10pm–8am)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-slate-400" />
              <span className="text-xs text-slate-600">Frequency cap:</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sage-50 text-sage-700">
                3 per customer/day
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
                    Safety
                  </th>
                  <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                  : rules
                      .filter((r) => !r.playbook)
                      .map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50">
                          <td className="p-3 text-sm font-medium">{rule.name}</td>
                          <td className="p-3 text-sm text-slate-600">{rule.trigger}</td>
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
                                onClick={() => handleTestRule(rule.id)}
                                className="text-slate-400 hover:text-sage-600 p-1"
                                data-testid={`test-rule-${rule.id}`}
                              >
                                <Play size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="text-slate-400 hover:text-red-500 p-1"
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
                          <td className="p-3 text-sm text-slate-600">{log.action}</td>
                          <td className="p-3">
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
                              {log.outcome}
                            </span>
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
          </div>
        </div>
      )}

      {/* Dry Run Modal */}
      {dryRunResult && <DryRunModal result={dryRunResult} onClose={() => setDryRunResult(null)} />}
    </div>
  );
}
