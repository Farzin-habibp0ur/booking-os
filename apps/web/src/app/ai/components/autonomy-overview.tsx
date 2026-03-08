'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { Settings } from 'lucide-react';

interface AutonomyLevel {
  agentId: string;
  agentName: string;
  level: 'off' | 'assist' | 'auto';
}

export function AutonomyOverview() {
  const { t } = useI18n();
  const [autonomyLevels, setAutonomyLevels] = useState<AutonomyLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAutonomy = async () => {
      try {
        setLoading(true);
        const data = await api.get<AutonomyLevel[]>('/ai/autonomy');
        setAutonomyLevels(data || []);
      } catch (err) {
        console.error('Failed to fetch autonomy levels:', err);
        // Mock data on failure
        setAutonomyLevels([
          { agentId: '1', agentName: 'Booking Agent', level: 'auto' },
          { agentId: '2', agentName: 'Follow-up Agent', level: 'assist' },
          { agentId: '3', agentName: 'Review Agent', level: 'off' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAutonomy();
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'auto':
        return 'bg-sage-500 dark:bg-sage-600';
      case 'assist':
        return 'bg-lavender-400 dark:bg-lavender-500';
      case 'off':
        return 'bg-slate-300 dark:bg-slate-600';
      default:
        return 'bg-slate-300';
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'auto':
        return 'Auto';
      case 'assist':
        return 'Assist';
      case 'off':
        return 'Off';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-lavender-50 dark:bg-slate-900/50 border border-lavender-100 dark:border-slate-800 p-6 shadow-soft animate-pulse">
        <div className="h-6 bg-lavender-200 dark:bg-slate-700 rounded w-1/3 mb-6"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-lavender-200 dark:bg-slate-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-lavender-50 dark:bg-slate-900/50 border border-lavender-100 dark:border-slate-800 p-6 shadow-soft">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-lg font-semibold text-slate-900 dark:text-white">
          Autonomy Levels
        </h2>
        <Link
          href="/settings/autonomy"
          className="inline-flex items-center gap-1 text-sm text-sage-600 dark:text-sage-400 hover:text-sage-700 dark:hover:text-sage-300 transition-colors"
        >
          <Settings size={16} />
          Configure
        </Link>
      </div>

      <div className="space-y-4">
        {autonomyLevels.map((item) => (
          <div key={item.agentId} className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-1.5">
                {item.agentName}
              </p>
              <div className="flex gap-2">
                {['off', 'assist', 'auto'].map((level) => (
                  <button
                    key={level}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                      item.level === level
                        ? cn(
                            getLevelColor(level),
                            'text-white shadow-sm',
                          )
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
                    )}
                  >
                    {getLevelLabel(level)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-6 pt-6 border-t border-lavender-200 dark:border-slate-800">
        <strong>Off:</strong> Disabled. <strong>Assist:</strong> Suggests actions for approval. <strong>Auto:</strong> Runs
        autonomously.
      </p>
    </div>
  );
}
