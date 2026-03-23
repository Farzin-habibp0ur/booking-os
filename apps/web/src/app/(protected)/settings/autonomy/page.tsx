'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { AutonomySettings } from '@/components/autonomy';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { FormSkeleton } from '@/components/skeleton';
import { ArrowLeft, RotateCcw, Shield, Bot } from 'lucide-react';

interface MarketingAutonomy {
  actionType: string;
  autonomyLevel: string;
  description?: string;
  defaultLevel?: string;
}

const MARKETING_ACTIONS: Record<
  string,
  { label: string; description: string; recommended: string }
> = {
  GREEN_CONTENT_PUBLISH: {
    label: 'Green Content Publish',
    description: 'Auto-publishable content that meets all quality gates',
    recommended: 'AUTO_WITH_REVIEW',
  },
  YELLOW_CONTENT_PUBLISH: {
    label: 'Yellow Content Publish',
    description: 'Content that needs review before publishing',
    recommended: 'SUGGEST',
  },
  RED_CONTENT_PUBLISH: {
    label: 'Red Content Publish',
    description: 'High-risk content requiring manual approval',
    recommended: 'OFF',
  },
  EMAIL_SEQUENCE_SEND: {
    label: 'Email Sequences',
    description: 'Automated email drip campaign delivery',
    recommended: 'AUTO_WITH_REVIEW',
  },
  SOCIAL_POSTING: {
    label: 'Social Posting',
    description: 'Publishing content to social media platforms',
    recommended: 'SUGGEST',
  },
  BUDGET_ALLOCATION: {
    label: 'Budget Allocation',
    description: 'Automated marketing spend decisions',
    recommended: 'OFF',
  },
  AGENT_SCHEDULING: {
    label: 'Agent Scheduling',
    description: 'Content and campaign scheduling by agents',
    recommended: 'AUTO_WITH_REVIEW',
  },
  ESCALATION_HANDLING: {
    label: 'Escalation Handling',
    description: 'How escalation events are handled',
    recommended: 'SUGGEST',
  },
};

const AUTONOMY_LEVELS = [
  { value: 'OFF', label: 'Off', color: 'bg-slate-100 text-slate-600' },
  { value: 'SUGGEST', label: 'Suggest', color: 'bg-blue-50 text-blue-700' },
  { value: 'AUTO_WITH_REVIEW', label: 'Auto + Review', color: 'bg-lavender-50 text-lavender-700' },
  { value: 'FULL_AUTO', label: 'Full Auto', color: 'bg-sage-50 text-sage-700' },
];

export default function AutonomySettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Marketing autonomy state
  const [mktAutonomy, setMktAutonomy] = useState<MarketingAutonomy[]>([]);
  const [mktLoading, setMktLoading] = useState(true);
  const [mktUpdating, setMktUpdating] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await api.get<any[]>('/autonomy');
      setConfigs(Array.isArray(res) ? res : []);
    } catch {
      toast('Failed to load autonomy settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchMktAutonomy = useCallback(async () => {
    try {
      const res = await api.get<MarketingAutonomy[]>('/autonomy-settings');
      setMktAutonomy(Array.isArray(res) ? res : []);
    } catch {
      // Non-critical — marketing module may not be enabled
    } finally {
      setMktLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchMktAutonomy();
  }, [fetchConfigs, fetchMktAutonomy]);

  const handleUpdate = async (actionType: string, level: string) => {
    setUpdating(true);
    try {
      await api.patch(`/autonomy/${actionType}`, { autonomyLevel: level });
      setConfigs((prev) => {
        const existing = prev.find((c) => c.actionType === actionType);
        if (existing) {
          return prev.map((c) =>
            c.actionType === actionType ? { ...c, autonomyLevel: level } : c,
          );
        }
        return [...prev, { actionType, autonomyLevel: level }];
      });
      toast('Autonomy level updated');
    } catch {
      toast('Failed to update autonomy level', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleMktUpdate = async (actionType: string, level: string) => {
    setMktUpdating(actionType);
    try {
      await api.patch(`/autonomy-settings/${actionType}`, { autonomyLevel: level });
      setMktAutonomy((prev) =>
        prev.map((a) => (a.actionType === actionType ? { ...a, autonomyLevel: level } : a)),
      );
      toast('Marketing autonomy updated');
    } catch {
      toast('Failed to update', 'error');
    } finally {
      setMktUpdating(null);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.post('/autonomy-settings/reset', {});
      await fetchMktAutonomy();
      toast('Reset to default levels');
    } catch {
      toast('Failed to reset', 'error');
    } finally {
      setResetting(false);
    }
  };

  const getMktLevel = (actionType: string) => {
    const found = mktAutonomy.find((a) => a.actionType === actionType);
    return found?.autonomyLevel || MARKETING_ACTIONS[actionType]?.recommended || 'OFF';
  };

  if (loading && mktLoading) return <FormSkeleton rows={3} />;

  return (
    <div className="p-6 max-w-3xl" data-testid="autonomy-settings-page">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>

      {/* Operational Autonomy */}
      <AutonomySettings configs={configs} onUpdate={handleUpdate} loading={updating} />

      {/* Marketing Autonomy */}
      <div className="mt-10" data-testid="marketing-autonomy-section">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-lavender-600" />
            <h2 className="text-lg font-serif font-semibold text-slate-900">Marketing Autonomy</h2>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            data-testid="reset-defaults-btn"
          >
            <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Control how much autonomy marketing AI agents have for each action type.
        </p>

        <div
          className="bg-white rounded-2xl shadow-soft overflow-hidden"
          data-testid="marketing-autonomy-table"
        >
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 border-b text-xs font-medium text-slate-500">
            <div className="col-span-4">Action</div>
            <div className="col-span-5">Autonomy Level</div>
            <div className="col-span-3 text-right">Status</div>
          </div>

          {/* Rows */}
          {Object.entries(MARKETING_ACTIONS).map(([actionType, meta]) => {
            const currentLevel = getMktLevel(actionType);
            const isRecommended = currentLevel === meta.recommended;

            return (
              <div
                key={actionType}
                className="grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-b-0 items-center"
                data-testid="autonomy-row"
              >
                <div className="col-span-4">
                  <p className="text-sm font-medium text-slate-900">{meta.label}</p>
                  <p className="text-xs text-slate-500">{meta.description}</p>
                </div>
                <div className="col-span-5">
                  <div className="flex gap-1">
                    {AUTONOMY_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        onClick={() => handleMktUpdate(actionType, level.value)}
                        disabled={mktUpdating === actionType}
                        className={cn(
                          'px-2 py-1 rounded-lg text-[11px] font-medium transition-all',
                          currentLevel === level.value
                            ? cn(
                                level.color,
                                'ring-2 ring-offset-1',
                                level.value === 'OFF'
                                  ? 'ring-slate-300'
                                  : level.value === 'SUGGEST'
                                    ? 'ring-blue-300'
                                    : level.value === 'AUTO_WITH_REVIEW'
                                      ? 'ring-lavender-300'
                                      : 'ring-sage-300',
                              )
                            : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300',
                        )}
                        data-testid={`level-${actionType}-${level.value}`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  {isRecommended ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sage-50 text-sage-700"
                      data-testid="recommended-badge"
                    >
                      <Shield size={10} />
                      Recommended
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">
                      Rec: {AUTONOMY_LEVELS.find((l) => l.value === meta.recommended)?.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
