'use client';

import { Package, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';

interface PackageTrackerProps {
  sessions: {
    total: number;
    used: number;
    packageName: string;
    expiresAt?: string;
  };
}

export default function PackageTracker({ sessions }: PackageTrackerProps) {
  const remaining = sessions.total - sessions.used;
  const progress = sessions.total > 0 ? (sessions.used / sessions.total) * 100 : 0;
  const isExpiringSoon =
    sessions.expiresAt &&
    new Date(sessions.expiresAt).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000;

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5" data-testid="package-tracker">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-lavender-50 flex items-center justify-center">
            <Package size={14} className="text-lavender-600" />
          </div>
          <span className="text-sm font-semibold text-slate-800">Session Package</span>
        </div>
        <div className="flex items-center gap-1 text-sage-600">
          <TrendingUp size={14} />
          <span className="text-xs font-medium">{Math.round(progress)}%</span>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-2">{sessions.packageName}</p>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            progress >= 80 ? 'bg-amber-400' : 'bg-sage-500',
          )}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {sessions.used} of {sessions.total} sessions used
        </span>
        <span
          className={cn(
            'text-xs font-medium',
            remaining <= 2 ? 'text-amber-600' : 'text-sage-600',
          )}
        >
          {remaining} remaining
        </span>
      </div>

      {isExpiringSoon && (
        <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
          Expires {new Date(sessions.expiresAt!).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
