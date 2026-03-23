'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ListSkeleton } from '@/components/skeleton';
import { SkillCard } from '@/components/agent-skills/skill-card';
import {
  Bot,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
} from 'lucide-react';

interface AgentSkill {
  agentType: string;
  name: string;
  description: string;
  category: 'proactive' | 'reactive' | 'maintenance';
  isEnabled: boolean;
  autonomyLevel: string;
  hasConfig: boolean;
}

interface MarketingAgentConfig {
  id: string;
  agentType: string;
  isEnabled: boolean;
  config: any;
  runIntervalMinutes?: number;
  lastRunAt?: string;
  nextRunAt?: string;
  performanceScore?: number;
}

interface AgentPerformance {
  agentType: string;
  performanceScore: number;
  totalRuns: number;
  successRate: number;
  avgItemsPerRun: number;
}

const AGENT_META: Record<
  string,
  { name: string; description: string; category: 'content' | 'distribution' | 'analytics' }
> = {
  MKT_BLOG_WRITER: {
    name: 'Blog Writer',
    description: 'SEO blog posts with 4 value layers',
    category: 'content',
  },
  MKT_SOCIAL_CREATOR: {
    name: 'Social Creator',
    description: 'Platform-native social content',
    category: 'content',
  },
  MKT_EMAIL_COMPOSER: {
    name: 'Email Composer',
    description: 'Email campaigns and sequences',
    category: 'content',
  },
  MKT_CASE_STUDY: {
    name: 'Case Study',
    description: 'Customer success case studies',
    category: 'content',
  },
  MKT_VIDEO_SCRIPT: {
    name: 'Video Script',
    description: 'Timestamped video scripts',
    category: 'content',
  },
  MKT_NEWSLETTER: {
    name: 'Newsletter',
    description: 'Weekly newsletter composition',
    category: 'content',
  },
  MKT_SCHEDULER: {
    name: 'Content Scheduler',
    description: 'Optimal posting time scheduling',
    category: 'distribution',
  },
  MKT_PUBLISHER: {
    name: 'Content Publisher',
    description: 'Cross-platform content publishing',
    category: 'distribution',
  },
  MKT_PERF_TRACKER: {
    name: 'Performance Tracker',
    description: 'Content performance metrics',
    category: 'analytics',
  },
  MKT_TREND_ANALYZER: {
    name: 'Trend Analyzer',
    description: 'Industry trend detection',
    category: 'analytics',
  },
  MKT_CALENDAR_PLANNER: {
    name: 'Calendar Planner',
    description: 'Content calendar management',
    category: 'analytics',
  },
  MKT_ROI_REPORTER: {
    name: 'ROI Reporter',
    description: 'Marketing ROI analysis',
    category: 'analytics',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  content: 'Content Agents',
  distribution: 'Distribution Agents',
  analytics: 'Analytics Agents',
};

const INTERVAL_PRESETS = [15, 30, 60, 120, 240];

const MKT_AUTONOMY_LEVELS = [
  { value: 'OFF', label: 'Off' },
  { value: 'SUGGEST', label: 'Suggest' },
  { value: 'AUTO_WITH_REVIEW', label: 'Auto + Review' },
  { value: 'FULL_AUTO', label: 'Full Auto' },
];

export default function AgentSkillsPage() {
  const { toast } = useToast();
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Marketing agents state
  const [mktConfigs, setMktConfigs] = useState<MarketingAgentConfig[]>([]);
  const [mktPerformance, setMktPerformance] = useState<AgentPerformance[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [mktUpdating, setMktUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [skillsRes, configsRes, perfRes] = await Promise.all([
        api.get<AgentSkill[]>('/agent-skills').catch(() => []),
        api
          .get<MarketingAgentConfig[] | { items: MarketingAgentConfig[] }>('/agent-config')
          .catch(() => []),
        api.get<AgentPerformance[]>('/agent-config/performance').catch(() => []),
      ]);
      setSkills(Array.isArray(skillsRes) ? skillsRes : []);
      setMktConfigs(
        Array.isArray(configsRes)
          ? configsRes
          : (configsRes as { items: MarketingAgentConfig[] }).items || [],
      );
      setMktPerformance(Array.isArray(perfRes) ? perfRes : []);
    } catch {
      toast('Failed to load agent settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Operational agent handlers
  const handleToggle = async (agentType: string, enabled: boolean) => {
    setUpdating(agentType);
    try {
      await api.patch(`/agent-skills/${agentType}/${enabled ? 'enable' : 'disable'}`);
      setSkills((prev) =>
        prev.map((s) =>
          s.agentType === agentType ? { ...s, isEnabled: enabled, hasConfig: true } : s,
        ),
      );
      toast(`${agentType} ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast(`Failed to ${enabled ? 'enable' : 'disable'} skill`, 'error');
    } finally {
      setUpdating(null);
    }
  };

  const handleAutonomyChange = async (agentType: string, level: string) => {
    setUpdating(agentType);
    try {
      await api.patch(`/agent-skills/${agentType}/config`, { autonomyLevel: level });
      setSkills((prev) =>
        prev.map((s) =>
          s.agentType === agentType ? { ...s, autonomyLevel: level, hasConfig: true } : s,
        ),
      );
      toast('Autonomy level updated');
    } catch {
      toast('Failed to update autonomy level', 'error');
    } finally {
      setUpdating(null);
    }
  };

  // Marketing agent handlers (optimistic UI)
  const handleMktToggle = async (agentType: string, isEnabled: boolean) => {
    setMktConfigs((prev) => prev.map((c) => (c.agentType === agentType ? { ...c, isEnabled } : c)));
    setMktUpdating(agentType);
    try {
      await api.patch(`/agent-config/${agentType}`, { isEnabled });
      toast(`${AGENT_META[agentType]?.name || agentType} ${isEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      setMktConfigs((prev) =>
        prev.map((c) => (c.agentType === agentType ? { ...c, isEnabled: !isEnabled } : c)),
      );
      toast('Failed to update', 'error');
    } finally {
      setMktUpdating(null);
    }
  };

  const handleMktIntervalChange = async (agentType: string, minutes: number) => {
    const prev = mktConfigs.find((c) => c.agentType === agentType)?.runIntervalMinutes;
    setMktConfigs((configs) =>
      configs.map((c) => (c.agentType === agentType ? { ...c, runIntervalMinutes: minutes } : c)),
    );
    setMktUpdating(agentType);
    try {
      await api.patch(`/agent-config/${agentType}`, { runIntervalMinutes: minutes });
      toast('Run interval updated');
    } catch {
      setMktConfigs((configs) =>
        configs.map((c) => (c.agentType === agentType ? { ...c, runIntervalMinutes: prev } : c)),
      );
      toast('Failed to update interval', 'error');
    } finally {
      setMktUpdating(null);
    }
  };

  const handleMktAutonomyChange = async (agentType: string, level: string) => {
    setMktUpdating(agentType);
    try {
      await api.patch(`/agent-config/${agentType}`, { autonomyLevel: level });
      toast('Autonomy updated');
    } catch {
      toast('Failed to update autonomy', 'error');
    } finally {
      setMktUpdating(null);
    }
  };

  const getConfigForType = (agentType: string) => mktConfigs.find((c) => c.agentType === agentType);

  const getPerfForType = (agentType: string) =>
    mktPerformance.find((p) => p.agentType === agentType);

  const proactive = skills.filter((s) => s.category === 'proactive');
  const reactive = skills.filter((s) => s.category === 'reactive');
  const maintenance = skills.filter((s) => s.category === 'maintenance');

  const marketingTypes = Object.keys(AGENT_META);
  const mktByCategory = (cat: string) =>
    marketingTypes.filter((t) => AGENT_META[t].category === cat);

  if (loading) return <ListSkeleton rows={4} />;

  return (
    <div className="p-6 max-w-3xl" data-testid="agent-skills-page">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>
      <div className="flex items-center gap-2 mb-6">
        <Bot size={24} className="text-lavender-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Agent Skills</h1>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Configure which AI agents are active for your business and their autonomy levels.
      </p>

      {/* Operational Agent Skills */}
      {skills.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
          <p className="text-slate-400">No agent skills available for your plan.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {proactive.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-700 mb-3">Proactive Agents</h2>
              <div className="space-y-3">
                {proactive.map((skill) => (
                  <SkillCard
                    key={skill.agentType}
                    skill={skill}
                    onToggle={handleToggle}
                    onAutonomyChange={handleAutonomyChange}
                    disabled={updating === skill.agentType}
                  />
                ))}
              </div>
            </section>
          )}
          {reactive.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-700 mb-3">Reactive Agents</h2>
              <div className="space-y-3">
                {reactive.map((skill) => (
                  <SkillCard
                    key={skill.agentType}
                    skill={skill}
                    onToggle={handleToggle}
                    onAutonomyChange={handleAutonomyChange}
                    disabled={updating === skill.agentType}
                  />
                ))}
              </div>
            </section>
          )}
          {maintenance.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-slate-700 mb-3">Maintenance Agents</h2>
              <div className="space-y-3">
                {maintenance.map((skill) => (
                  <SkillCard
                    key={skill.agentType}
                    skill={skill}
                    onToggle={handleToggle}
                    onAutonomyChange={handleAutonomyChange}
                    disabled={updating === skill.agentType}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Marketing Agents Section */}
      <div className="mt-10" data-testid="marketing-agents-section">
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">Marketing Agents</h2>
        <p className="text-sm text-slate-500 mb-4">
          12 autonomous marketing agents with configurable intervals and autonomy levels.
        </p>

        {['content', 'distribution', 'analytics'].map((cat) => (
          <section key={cat} className="mb-6">
            <h3 className="text-sm font-medium text-slate-700 mb-3">{CATEGORY_LABELS[cat]}</h3>
            <div className="space-y-2">
              {mktByCategory(cat).map((agentType) => {
                const meta = AGENT_META[agentType];
                const config = getConfigForType(agentType);
                const perf = getPerfForType(agentType);
                const isEnabled = config?.isEnabled ?? false;
                const isExpanded = expandedAgent === agentType;

                return (
                  <div
                    key={agentType}
                    className="rounded-2xl border bg-white shadow-sm overflow-hidden"
                    data-testid="mkt-agent-card"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center',
                              cat === 'content'
                                ? 'bg-lavender-50'
                                : cat === 'distribution'
                                  ? 'bg-blue-50'
                                  : 'bg-amber-50',
                            )}
                          >
                            {cat === 'content' ? (
                              <FileText size={16} className="text-lavender-600" />
                            ) : cat === 'distribution' ? (
                              <Send size={16} className="text-blue-600" />
                            ) : (
                              <BarChart3 size={16} className="text-amber-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900">{meta.name}</p>
                            <p className="text-xs text-slate-500">{meta.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedAgent(isExpanded ? null : agentType)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
                            data-testid="mkt-expand-btn"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <button
                            onClick={() => handleMktToggle(agentType, !isEnabled)}
                            className={cn(
                              'relative w-10 h-5 rounded-full transition-colors',
                              isEnabled ? 'bg-sage-500' : 'bg-slate-200',
                            )}
                            data-testid="mkt-toggle-btn"
                            role="switch"
                            aria-checked={isEnabled}
                          >
                            <span
                              className={cn(
                                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                                isEnabled ? 'translate-x-5' : 'translate-x-0',
                              )}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Config Panel */}
                    {isExpanded && (
                      <div
                        className="border-t bg-slate-50 p-4 space-y-4"
                        data-testid="mkt-config-panel"
                      >
                        {/* Run Interval */}
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-2">
                            Run Interval (minutes)
                          </label>
                          <div className="flex items-center gap-2">
                            {INTERVAL_PRESETS.map((min) => (
                              <button
                                key={min}
                                onClick={() => handleMktIntervalChange(agentType, min)}
                                className={cn(
                                  'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                                  config?.runIntervalMinutes === min
                                    ? 'bg-lavender-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-lavender-300',
                                )}
                                data-testid={`interval-${min}`}
                              >
                                {min}m
                              </button>
                            ))}
                            <input
                              type="number"
                              value={config?.runIntervalMinutes || 60}
                              onChange={(e) =>
                                handleMktIntervalChange(agentType, parseInt(e.target.value) || 60)
                              }
                              className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg text-center"
                              data-testid="interval-custom"
                            />
                          </div>
                        </div>

                        {/* Autonomy Level */}
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-2">
                            Autonomy Level
                          </label>
                          <select
                            value={config?.config?.autonomyLevel || 'SUGGEST'}
                            onChange={(e) => handleMktAutonomyChange(agentType, e.target.value)}
                            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white"
                            data-testid="mkt-autonomy-select"
                          >
                            {MKT_AUTONOMY_LEVELS.map((l) => (
                              <option key={l.value} value={l.value}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Performance Summary */}
                        <div>
                          <label className="text-xs font-medium text-slate-600 block mb-2">
                            Performance Summary
                          </label>
                          <div className="grid grid-cols-4 gap-2" data-testid="mkt-perf-summary">
                            <div className="rounded-lg bg-white p-2 text-center">
                              <div className="text-[10px] text-slate-500">Total Runs</div>
                              <div className="text-sm font-bold text-slate-900">
                                {perf?.totalRuns ?? 0}
                              </div>
                            </div>
                            <div className="rounded-lg bg-white p-2 text-center">
                              <div className="text-[10px] text-slate-500">Success Rate</div>
                              <div className="text-sm font-bold text-slate-900">
                                {Math.round(perf?.successRate ?? 0)}%
                              </div>
                            </div>
                            <div className="rounded-lg bg-white p-2 text-center">
                              <div className="text-[10px] text-slate-500">Avg Items</div>
                              <div className="text-sm font-bold text-slate-900">
                                {(perf?.avgItemsPerRun ?? 0).toFixed(1)}
                              </div>
                            </div>
                            <div className="rounded-lg bg-white p-2 text-center">
                              <div className="text-[10px] text-slate-500">Score</div>
                              <div
                                className={cn(
                                  'text-sm font-bold',
                                  (config?.performanceScore ?? 0) >= 80
                                    ? 'text-sage-600'
                                    : (config?.performanceScore ?? 0) >= 50
                                      ? 'text-amber-600'
                                      : 'text-red-500',
                                )}
                              >
                                {Math.round(config?.performanceScore ?? 0)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Last Run Info */}
                        {config?.lastRunAt && (
                          <div className="text-xs text-slate-500">
                            Last run: {new Date(config.lastRunAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
