'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';
import { AutonomyBadge } from './autonomy-badge';

const ACTION_TYPES = [
  {
    type: 'DEPOSIT_PENDING',
    label: 'Deposit Reminders',
    description: 'Send deposit request to customers with pending deposits',
  },
  {
    type: 'OVERDUE_REPLY',
    label: 'Overdue Replies',
    description: 'Flag conversations needing response',
  },
  {
    type: 'OPEN_SLOT',
    label: 'Open Slot Notifications',
    description: 'Notify waitlist customers about available slots',
  },
  {
    type: 'STALLED_QUOTE',
    label: 'Stalled Quote Follow-up',
    description: 'Follow up on unanswered quotes',
  },
  {
    type: 'WAITLIST_MATCH',
    label: 'Waitlist Matching',
    description: 'Match waitlist entries to cancellations',
  },
  {
    type: 'RETENTION_DUE',
    label: 'Retention Outreach',
    description: 'Reach out to customers overdue for their next visit',
  },
  {
    type: 'DATA_HYGIENE',
    label: 'Data Cleanup',
    description: 'Detect and merge duplicate customer records',
  },
  {
    type: 'SCHEDULE_GAP',
    label: 'Schedule Optimization',
    description: 'Suggest schedule improvements to reduce gaps',
  },
];

const LEVELS = ['OFF', 'ASSISTED', 'AUTO'] as const;

interface AutonomyConfig {
  actionType: string;
  autonomyLevel: string;
  constraints?: any;
}

interface AutonomySettingsProps {
  configs: AutonomyConfig[];
  onUpdate: (actionType: string, level: string, constraints?: any) => void;
  loading?: boolean;
}

export function AutonomySettings({ configs, onUpdate, loading }: AutonomySettingsProps) {
  const getLevel = (actionType: string) => {
    const config = configs.find((c) => c.actionType === actionType);
    return config?.autonomyLevel || 'ASSISTED';
  };

  return (
    <div data-testid="autonomy-settings" className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Shield size={20} className="text-lavender-600" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          AI Autonomy Settings
        </h2>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Control how much autonomy the AI has for each action type.
        <strong> Off</strong> = AI does nothing. <strong>Assisted</strong> = AI proposes, you
        decide.
        <strong> Auto</strong> = AI executes within constraints.
      </p>

      <div className="space-y-3">
        {ACTION_TYPES.map(({ type, label, description }) => {
          const currentLevel = getLevel(type);

          return (
            <div
              key={type}
              data-testid={`autonomy-row-${type}`}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
                  <AutonomyBadge level={currentLevel} />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-xl p-1">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => onUpdate(type, level)}
                    disabled={loading}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                      currentLevel === level
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                    data-testid={`level-${type}-${level}`}
                  >
                    {level === 'OFF' ? 'Off' : level === 'ASSISTED' ? 'Assist' : 'Auto'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
