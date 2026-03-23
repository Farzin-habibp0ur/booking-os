'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Settings, Shield } from 'lucide-react';

interface AutonomySetting {
  id: string;
  actionType: string;
  autonomyLevel: string; // OFF, SUGGEST, AUTO_WITH_REVIEW, FULL_AUTO
  scope?: string;
}

const LEVEL_ORDER = ['OFF', 'SUGGEST', 'AUTO_WITH_REVIEW', 'FULL_AUTO'] as const;

const LEVEL_CONFIG: Record<string, { label: string; short: string; color: string }> = {
  OFF: { label: 'Off', short: 'Off', color: 'bg-slate-300 dark:bg-slate-600' },
  SUGGEST: { label: 'Suggest', short: 'Sug', color: 'bg-lavender-400 dark:bg-lavender-500' },
  AUTO_WITH_REVIEW: {
    label: 'Auto + Review',
    short: 'A+R',
    color: 'bg-amber-500 dark:bg-amber-600',
  },
  FULL_AUTO: { label: 'Full Auto', short: 'Auto', color: 'bg-sage-500 dark:bg-sage-600' },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  CONTENT_CREATION: 'Content Creation',
  CONTENT_PUBLISHING: 'Content Publishing',
  EMAIL_CAMPAIGNS: 'Email Campaigns',
  SOCIAL_POSTING: 'Social Posting',
  TREND_RESEARCH: 'Trend Research',
  PERFORMANCE_REPORTING: 'Performance Reports',
  BUDGET_ALLOCATION: 'Budget Allocation',
  AB_TESTING: 'A/B Testing',
};

export function AutonomyOverview() {
  const [settings, setSettings] = useState<AutonomySetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await api.get<AutonomySetting[]>('/autonomy-settings');
        setSettings(Array.isArray(data) ? data : []);
      } catch {
        setSettings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const levelCounts = LEVEL_ORDER.reduce(
    (acc, level) => {
      acc[level] = settings.filter((s) => s.autonomyLevel === level).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (loading) {
    return (
      <div className="rounded-2xl bg-lavender-50 dark:bg-slate-900/50 border border-lavender-100 dark:border-slate-800 p-6 shadow-soft animate-pulse">
        <div className="h-6 bg-lavender-200 dark:bg-slate-700 rounded w-1/3 mb-6"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 bg-lavender-200 dark:bg-slate-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-lavender-50 dark:bg-slate-900/50 border border-lavender-100 dark:border-slate-800 p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-lavender-500" />
          <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
            Marketing Autonomy
          </h2>
        </div>
        <Link
          href="/settings/autonomy"
          className="inline-flex items-center gap-1 text-xs text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300 transition-colors"
        >
          <Settings size={14} />
          Configure
        </Link>
      </div>

      {/* Level Summary Bar */}
      {settings.length > 0 && (
        <div className="flex gap-1 mb-4">
          {LEVEL_ORDER.map((level) => {
            const count = levelCounts[level] || 0;
            if (count === 0) return null;
            const config = LEVEL_CONFIG[level];
            return (
              <div
                key={level}
                className={cn('h-2 rounded-full', config.color)}
                style={{ flex: count }}
                title={`${config.label}: ${count}`}
              />
            );
          })}
        </div>
      )}

      {/* Settings List */}
      <div className="space-y-2.5">
        {settings.slice(0, 6).map((setting) => {
          const config = LEVEL_CONFIG[setting.autonomyLevel] || LEVEL_CONFIG.OFF;
          return (
            <div
              key={setting.id || setting.actionType}
              className="flex items-center justify-between"
            >
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                {ACTION_TYPE_LABELS[setting.actionType] || setting.actionType.replace(/_/g, ' ')}
              </p>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium text-white flex-shrink-0',
                  config.color,
                )}
              >
                {config.short}
              </span>
            </div>
          );
        })}
        {settings.length > 6 && (
          <p className="text-[11px] text-slate-500 text-center pt-1">
            +{settings.length - 6} more settings
          </p>
        )}
      </div>

      {settings.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-4">
          No marketing autonomy settings configured yet.
        </p>
      )}

      <div className="text-[10px] text-slate-500 mt-4 pt-4 border-t border-lavender-200 dark:border-slate-800 space-x-2">
        <span>
          <strong>Off:</strong> Disabled
        </span>
        <span>
          <strong>Suggest:</strong> Recommends
        </span>
        <span>
          <strong>A+R:</strong> Auto with review
        </span>
        <span>
          <strong>Auto:</strong> Fully autonomous
        </span>
      </div>
    </div>
  );
}
