'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useToast } from '@/lib/toast';
import {
  Mail,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle2,
  Pause,
  Play,
  XCircle,
  AlertTriangle,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import { ListSkeleton } from '@/components/skeleton';

interface SequenceStep {
  step: number;
  delayHours: number;
  subject: string;
  headline: string;
  body: string;
  ctaLabel?: string;
  ctaPath?: string;
}

interface StepMetric {
  step: number;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
  dropOff: number;
}

interface BottleneckResult {
  bottleneckStep: number;
  dropOffRate: number;
  subject: string;
  suggestion?: string;
}

interface SequenceMetrics {
  steps: StepMetric[];
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  overallOpenRate: number;
  overallClickRate: number;
  completionRate: number;
}

interface EmailSequence {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  steps: SequenceStep[];
  triggerEvent?: string;
  stopOnEvent?: string;
  metrics?: any;
  _count: { enrollments: number };
}

interface Stats {
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  totalEnrolled: number;
}

const TYPE_STYLES: Record<string, string> = {
  WELCOME: 'bg-sage-50 text-sage-700',
  FEATURE_EDUCATION: 'bg-blue-50 text-blue-700',
  SOCIAL_PROOF: 'bg-purple-50 text-purple-700',
  TRIAL_EXPIRY: 'bg-amber-50 text-amber-700',
  WIN_BACK: 'bg-red-50 text-red-700',
  UPGRADE: 'bg-lavender-50 text-lavender-700',
  REFERRAL: 'bg-emerald-50 text-emerald-700',
  CUSTOM: 'bg-slate-100 text-slate-600',
};

const TYPE_LABELS: Record<string, string> = {
  WELCOME: 'Welcome',
  FEATURE_EDUCATION: 'Education',
  SOCIAL_PROOF: 'Social Proof',
  TRIAL_EXPIRY: 'Trial Expiry',
  WIN_BACK: 'Win Back',
  UPGRADE: 'Upgrade',
  REFERRAL: 'Referral',
  CUSTOM: 'Custom',
};

export default function EmailSequencesPage() {
  const { toast } = useToast();
  const [sequences, setSequences] = useState<EmailSequence[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [metricsMap, setMetricsMap] = useState<Record<string, SequenceMetrics>>({});
  const [bottleneckMap, setBottleneckMap] = useState<Record<string, BottleneckResult>>({});
  const [loadingMetrics, setLoadingMetrics] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [seqRes, statsRes] = await Promise.all([
        api.get<EmailSequence[]>('/email-sequences'),
        api.get<Stats>('/email-sequences/stats'),
      ]);
      setSequences(Array.isArray(seqRes) ? seqRes : []);
      setStats(statsRes);
    } catch {
      // handled by api client
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/email-sequences/${id}`, { isActive: !isActive });
      toast(`Sequence ${!isActive ? 'activated' : 'deactivated'}`, 'success');
      fetchData();
    } catch {
      toast('Failed to update sequence', 'error');
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    if (!metricsMap[id]) {
      setLoadingMetrics(id);
      try {
        const [metricsRes, bottleneckRes] = await Promise.all([
          api.get<SequenceMetrics>(`/email-sequences/${id}/metrics`).catch(() => null),
          api.get<BottleneckResult>(`/email-sequences/${id}/bottleneck`).catch(() => null),
        ]);
        if (metricsRes) {
          setMetricsMap((prev) => ({ ...prev, [id]: metricsRes }));
        }
        if (bottleneckRes) {
          setBottleneckMap((prev) => ({ ...prev, [id]: bottleneckRes }));
        }
      } catch {
        // non-critical
      } finally {
        setLoadingMetrics(null);
      }
    }
  };

  const activeCount = sequences.filter((s) => s.isActive).length;
  const totalEnrolled = stats?.totalEnrolled || 0;
  const completedCount = stats?.byStatus?.COMPLETED || 0;
  const activeEnrollments = stats?.byStatus?.ACTIVE || 0;
  const avgConversion =
    sequences.length > 0
      ? Math.round(
          Object.values(metricsMap).reduce((sum, m) => sum + (m.completionRate || 0), 0) /
            Math.max(Object.keys(metricsMap).length, 1),
        )
      : 0;

  const formatDelay = (hours: number) => {
    if (hours === 0) return 'Immediately';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `Day ${days}`;
  };

  return (
    <div className="space-y-6" data-testid="sequences-page">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Email Sequences</h1>
        <p className="text-sm text-slate-500 mt-1">
          Automated email drip campaigns for onboarding, retention, and growth
        </p>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-4 gap-4" data-testid="stats-strip">
        <div className="rounded-2xl bg-lavender-50 p-4">
          <div className="text-sm text-lavender-600">Active Sequences</div>
          <div className="text-2xl font-bold text-lavender-700" data-testid="active-count">
            {activeCount}
          </div>
        </div>
        <div className="rounded-2xl bg-sage-50 p-4">
          <div className="text-sm text-sage-600">Total Enrolled</div>
          <div className="text-2xl font-bold text-sage-700" data-testid="total-enrolled">
            {totalEnrolled}
          </div>
        </div>
        <div className="rounded-2xl bg-blue-50 p-4">
          <div className="text-sm text-blue-600">Active Enrollments</div>
          <div className="text-2xl font-bold text-blue-700" data-testid="active-enrollments">
            {activeEnrollments}
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-4">
          <div className="text-sm text-emerald-600">Avg Conversion</div>
          <div className="text-2xl font-bold text-emerald-700" data-testid="avg-conversion">
            {avgConversion}%
          </div>
        </div>
      </div>

      {/* Sequence Cards */}
      {loading ? (
        <ListSkeleton rows={4} />
      ) : sequences.length === 0 ? (
        <div className="text-center py-16 text-slate-400" data-testid="empty-state">
          <Mail size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No email sequences</p>
          <p className="text-sm mt-1">Seed default sequences to get started</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="sequence-list">
          {sequences.map((seq) => {
            const metrics = metricsMap[seq.id];
            const bottleneck = bottleneckMap[seq.id];

            return (
              <div
                key={seq.id}
                className="rounded-2xl border bg-white shadow-sm overflow-hidden"
                data-testid="sequence-card"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-lavender-50 flex items-center justify-center">
                        <Mail size={18} className="text-lavender-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900">{seq.name}</h3>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              TYPE_STYLES[seq.type] || TYPE_STYLES.CUSTOM,
                            )}
                            data-testid="type-badge"
                          >
                            {TYPE_LABELS[seq.type] || seq.type}
                          </span>
                          {bottleneck && (
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 inline-flex items-center gap-1"
                              data-testid="bottleneck-badge"
                            >
                              <AlertTriangle size={10} />
                              Bottleneck at step {bottleneck.bottleneckStep}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>{seq.steps.length} steps</span>
                          <span className="inline-flex items-center gap-1">
                            <Users size={12} />
                            {seq._count.enrollments} enrolled
                          </span>
                          {metrics && (
                            <span
                              className="inline-flex items-center gap-1 text-sage-600"
                              data-testid="completion-rate"
                            >
                              <CheckCircle2 size={12} />
                              {Math.round(metrics.completionRate)}% completion
                            </span>
                          )}
                          {seq.triggerEvent && (
                            <span>
                              Trigger: {seq.triggerEvent.replace(/_/g, ' ').toLowerCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleExpand(seq.id)}
                        className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100"
                        data-testid="expand-btn"
                      >
                        {expandedId === seq.id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleToggle(seq.id, seq.isActive)}
                        className={cn(
                          'relative w-11 h-6 rounded-full transition-colors',
                          seq.isActive ? 'bg-sage-500' : 'bg-slate-200',
                        )}
                        data-testid="toggle-btn"
                        role="switch"
                        aria-checked={seq.isActive}
                      >
                        <span
                          className={cn(
                            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                            seq.isActive ? 'translate-x-5' : 'translate-x-0',
                          )}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: Steps Timeline with Metrics */}
                {expandedId === seq.id && (
                  <div className="border-t px-4 py-3 bg-slate-50" data-testid="steps-timeline">
                    {loadingMetrics === seq.id ? (
                      <div className="text-center py-4 text-sm text-slate-400">
                        Loading metrics...
                      </div>
                    ) : (
                      <>
                        {/* Metrics Summary Bar */}
                        {metrics && (
                          <div
                            className="grid grid-cols-4 gap-3 mb-4"
                            data-testid="metrics-summary"
                          >
                            <div className="rounded-xl bg-white p-2.5 text-center">
                              <div className="text-xs text-slate-500">Total Sent</div>
                              <div className="text-sm font-bold text-slate-900">
                                {metrics.totalSent}
                              </div>
                            </div>
                            <div className="rounded-xl bg-white p-2.5 text-center">
                              <div className="text-xs text-slate-500">Open Rate</div>
                              <div className="text-sm font-bold text-slate-900">
                                {Math.round(metrics.overallOpenRate)}%
                              </div>
                            </div>
                            <div className="rounded-xl bg-white p-2.5 text-center">
                              <div className="text-xs text-slate-500">Click Rate</div>
                              <div className="text-sm font-bold text-slate-900">
                                {Math.round(metrics.overallClickRate)}%
                              </div>
                            </div>
                            <div className="rounded-xl bg-white p-2.5 text-center">
                              <div className="text-xs text-slate-500">Completion</div>
                              <div className="text-sm font-bold text-slate-900">
                                {Math.round(metrics.completionRate)}%
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Steps Timeline */}
                        <div className="space-y-3">
                          {seq.steps.map((step, idx) => {
                            const stepMetric = metrics?.steps?.find((m) => m.step === step.step);
                            const isBottleneck = bottleneck?.bottleneckStep === step.step;

                            return (
                              <div
                                key={step.step}
                                className={cn('flex items-start gap-3', isBottleneck && 'relative')}
                                data-testid="step-row"
                              >
                                <div className="flex flex-col items-center">
                                  <div
                                    className={cn(
                                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                                      isBottleneck
                                        ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                                        : 'bg-lavender-100 text-lavender-700',
                                    )}
                                    data-testid={isBottleneck ? 'bottleneck-step' : 'step-number'}
                                  >
                                    {isBottleneck ? <AlertTriangle size={14} /> : step.step}
                                  </div>
                                  {idx < seq.steps.length - 1 && (
                                    <div
                                      className={cn(
                                        'w-px h-6 mt-1',
                                        isBottleneck ? 'bg-amber-300' : 'bg-lavender-200',
                                      )}
                                    />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-900">
                                      {step.subject}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      {formatDelay(step.delayHours)}
                                    </span>
                                    {isBottleneck && (
                                      <span className="text-xs text-amber-600 font-medium">
                                        {Math.round(bottleneck.dropOffRate)}% drop-off
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                    {step.body}
                                  </p>

                                  {/* Per-Step Metrics */}
                                  {stepMetric && (
                                    <div
                                      className="flex items-center gap-4 mt-1.5 text-xs"
                                      data-testid="step-metrics"
                                    >
                                      <span className="text-slate-500">
                                        Sent:{' '}
                                        <span className="font-medium text-slate-700">
                                          {stepMetric.sent}
                                        </span>
                                      </span>
                                      <span className="text-slate-500">
                                        Open:{' '}
                                        <span
                                          className={cn(
                                            'font-medium',
                                            stepMetric.openRate >= 30
                                              ? 'text-sage-600'
                                              : stepMetric.openRate >= 15
                                                ? 'text-amber-600'
                                                : 'text-red-500',
                                          )}
                                        >
                                          {Math.round(stepMetric.openRate)}%
                                        </span>
                                      </span>
                                      <span className="text-slate-500">
                                        Click:{' '}
                                        <span
                                          className={cn(
                                            'font-medium',
                                            stepMetric.clickRate >= 5
                                              ? 'text-sage-600'
                                              : stepMetric.clickRate >= 2
                                                ? 'text-amber-600'
                                                : 'text-red-500',
                                          )}
                                        >
                                          {Math.round(stepMetric.clickRate)}%
                                        </span>
                                      </span>
                                      {stepMetric.dropOff > 0 && (
                                        <span className="text-red-500 inline-flex items-center gap-0.5">
                                          <TrendingDown size={10} />
                                          {Math.round(stepMetric.dropOff)}% drop
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Bottleneck Suggestion */}
                        {bottleneck?.suggestion && (
                          <div
                            className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm"
                            data-testid="bottleneck-suggestion"
                          >
                            <div className="flex items-center gap-2 font-medium text-amber-700 mb-1">
                              <AlertTriangle size={14} />
                              Optimization Suggestion
                            </div>
                            <p className="text-amber-600">{bottleneck.suggestion}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
