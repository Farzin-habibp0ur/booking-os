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

interface EmailSequence {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  steps: SequenceStep[];
  triggerEvent?: string;
  stopOnEvent?: string;
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

  const activeCount = sequences.filter((s) => s.isActive).length;
  const totalEnrolled = stats?.totalEnrolled || 0;
  const completedCount = stats?.byStatus?.COMPLETED || 0;
  const activeEnrollments = stats?.byStatus?.ACTIVE || 0;

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
          <div className="text-sm text-emerald-600">Completed</div>
          <div className="text-2xl font-bold text-emerald-700" data-testid="completed-count">
            {completedCount}
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
          {sequences.map((seq) => (
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
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        <span>{seq.steps.length} steps</span>
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} />
                          {seq._count.enrollments} enrolled
                        </span>
                        {seq.triggerEvent && (
                          <span>Trigger: {seq.triggerEvent.replace(/_/g, ' ').toLowerCase()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setExpandedId(expandedId === seq.id ? null : seq.id)}
                      className="p-2 rounded-lg bg-slate-50 text-slate-400 hover:bg-slate-100"
                      data-testid="expand-btn"
                    >
                      {expandedId === seq.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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

              {/* Expanded: Steps Timeline */}
              {expandedId === seq.id && (
                <div className="border-t px-4 py-3 bg-slate-50" data-testid="steps-timeline">
                  <div className="space-y-3">
                    {seq.steps.map((step, idx) => (
                      <div key={step.step} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-lavender-100 flex items-center justify-center text-xs font-bold text-lavender-700">
                            {step.step}
                          </div>
                          {idx < seq.steps.length - 1 && (
                            <div className="w-px h-6 bg-lavender-200 mt-1" />
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
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{step.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
