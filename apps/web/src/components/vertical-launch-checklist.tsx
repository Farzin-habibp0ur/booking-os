'use client';

import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ChecklistItem {
  key: string;
  done: boolean;
  fixUrl: string;
}

interface VerticalLaunchChecklistProps {
  items: ChecklistItem[];
  allComplete: boolean;
}

const ITEM_LABELS: Record<string, { title: string; description: string }> = {
  business_name: {
    title: 'Set business name',
    description: 'Update your business name from the default',
  },
  staff_added: {
    title: 'Add staff members',
    description: 'Add at least one non-admin staff member',
  },
  services_created: {
    title: 'Create services',
    description: 'Set up your service menu with pricing',
  },
  whatsapp_connected: {
    title: 'Connect calendar',
    description: 'Sync with an external calendar provider',
  },
  templates_ready: {
    title: 'Set up templates',
    description: 'Create confirmation and reminder message templates',
  },
  first_booking: {
    title: 'First booking',
    description: 'Create or receive your first booking',
  },
  first_deposit: {
    title: 'First deposit',
    description: 'Collect your first deposit payment',
  },
  roi_baseline: {
    title: 'Set ROI baseline',
    description: 'Configure your revenue baseline for tracking',
  },
  agents_configured: {
    title: 'Configure AI agents',
    description: 'Enable at least one AI agent skill',
  },
};

export function VerticalLaunchChecklist({ items, allComplete }: VerticalLaunchChecklistProps) {
  const completedCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (allComplete) {
    return (
      <div
        className="bg-sage-50 rounded-2xl p-4 border border-sage-100"
        data-testid="launch-checklist"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={20} className="text-sage-600" />
          <p className="text-sm font-medium text-sage-800">All set! Your business is ready.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5" data-testid="launch-checklist">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Launch Checklist</h3>
        <span className="text-xs text-slate-500">
          {completedCount}/{items.length} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
        <div
          className="bg-sage-500 h-1.5 rounded-full transition-all"
          style={{ width: `${progress}%` }}
          data-testid="progress-bar"
        />
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const label = ITEM_LABELS[item.key] || { title: item.key, description: '' };
          return (
            <div
              key={item.key}
              className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
                item.done ? 'opacity-60' : 'hover:bg-slate-50'
              }`}
            >
              {item.done ? (
                <CheckCircle2 size={18} className="text-sage-500 shrink-0" />
              ) : (
                <Circle size={18} className="text-slate-300 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${item.done ? 'text-slate-500 line-through' : 'text-slate-900'}`}
                >
                  {label.title}
                </p>
                {!item.done && label.description && (
                  <p className="text-xs text-slate-400">{label.description}</p>
                )}
              </div>
              {!item.done && (
                <Link
                  href={item.fixUrl}
                  className="text-sage-600 hover:text-sage-700 shrink-0"
                  data-testid={`fix-${item.key}`}
                >
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
