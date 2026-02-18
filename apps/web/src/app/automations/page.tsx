'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import { Zap, Plus, ToggleLeft, ToggleRight, Trash2, Play } from 'lucide-react';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import TooltipNudge from '@/components/tooltip-nudge';

type Tab = 'playbooks' | 'rules' | 'logs';

export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>('playbooks');
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
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
  const loadLogs = () =>
    api
      .get<any>('/automations/logs?pageSize=50')
      .then(setLogs)
      .catch((err: any) => toast(err.message || 'Failed to load activity logs', 'error'));

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPlaybooks(), loadRules(), loadLogs()]).finally(() => setLoading(false));
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
    try {
      const result = await api.post<any>(`/automations/rules/${id}/test`);
      alert(result.message);
    } catch (err: any) {
      alert(`Test failed: ${err.message}`);
    }
  };

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
                <div key={pb.playbook || pb.id} className="bg-white rounded-2xl shadow-soft p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">{pb.name}</h3>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        pb.isActive ? 'bg-sage-50 text-sage-700' : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {pb.isActive ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{pb.description}</p>
                  <button
                    onClick={() => handleTogglePlaybook(pb.playbook)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors',
                      pb.isActive
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-sage-600 text-white hover:bg-sage-700',
                    )}
                  >
                    {pb.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {pb.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
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
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} cols={4} />)
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
      )}
    </div>
  );
}
