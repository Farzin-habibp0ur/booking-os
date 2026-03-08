'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { trackEvent } from '@/lib/posthog';
import {
  CalendarPlus,
  Share2,
  Bell,
  MessageSquare,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Check,
  X,
} from 'lucide-react';

interface ActivationStatus {
  real_booking: boolean;
  link_shared: boolean;
  notification_received: boolean;
  inbox_reply: boolean;
  briefing_viewed: boolean;
}

const ACTIVATION_STEPS = [
  {
    key: 'real_booking' as const,
    label: 'Create a real booking',
    icon: CalendarPlus,
    href: '/calendar',
  },
  {
    key: 'link_shared' as const,
    label: 'Share your booking link',
    icon: Share2,
    href: '/settings',
  },
  {
    key: 'notification_received' as const,
    label: 'Receive a booking notification',
    icon: Bell,
    href: '/bookings',
  },
  {
    key: 'inbox_reply' as const,
    label: 'Reply to a message',
    icon: MessageSquare,
    href: '/inbox',
  },
  {
    key: 'briefing_viewed' as const,
    label: 'View your Daily Briefing',
    icon: BarChart3,
    href: '/dashboard',
  },
];

export function ActivationWidget() {
  const [status, setStatus] = useState<ActivationStatus | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('activation-widget-dismissed')) {
      setDismissed(true);
      return;
    }
    api
      .get<{ steps: ActivationStatus }>('/business/activation-status')
      .then((res) => {
        setStatus(res.steps);
        const completed = Object.values(res.steps).filter(Boolean).length;
        if (completed >= 3) {
          trackEvent('activation_milestone_reached', { completed });
        }
      })
      .catch(() => {
        setDismissed(true);
      });
  }, []);

  if (dismissed || !status) return null;

  const completed = Object.values(status).filter(Boolean).length;
  const total = ACTIVATION_STEPS.length;

  if (completed === total) {
    // Auto-dismiss after all complete
    if (typeof window !== 'undefined') {
      localStorage.setItem('activation-widget-dismissed', 'true');
    }
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('activation-widget-dismissed', 'true');
    }
  };

  const handleStepClick = (step: (typeof ACTIVATION_STEPS)[0]) => {
    trackEvent('activation_action_clicked', { action: step.key });
  };

  return (
    <div className="mx-2 mb-2">
      <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Get Started</p>
            <p className="text-[10px] text-slate-400">
              {completed} of {total} completed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="text-slate-300 hover:text-slate-500 transition-colors"
              aria-label="Dismiss activation checklist"
            >
              <X size={12} />
            </button>
            {expanded ? (
              <ChevronUp size={14} className="text-slate-400" />
            ) : (
              <ChevronDown size={14} className="text-slate-400" />
            )}
          </div>
        </button>

        {/* Progress bar */}
        <div className="px-3 pb-2">
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-sage-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        {expanded && (
          <div className="px-2 pb-2 space-y-0.5">
            {ACTIVATION_STEPS.map((step) => {
              const done = status[step.key];
              const Icon = step.icon;
              return (
                <a
                  key={step.key}
                  href={step.href}
                  onClick={() => handleStepClick(step)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    done
                      ? 'text-slate-400 dark:text-slate-500'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-sage-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {done ? (
                    <div className="w-4 h-4 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className="text-sage-600" />
                    </div>
                  ) : (
                    <Icon size={14} className="text-slate-400 flex-shrink-0" />
                  )}
                  <span className={done ? 'line-through' : ''}>{step.label}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
