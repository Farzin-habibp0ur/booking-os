'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ELEVATION } from '@/lib/design-tokens';

interface OnboardingStatus {
  business_name: boolean;
  whatsapp_connected: boolean;
  staff_added: boolean;
  services_created: boolean;
  templates_ready: boolean;
  first_booking: boolean;
}

interface OnboardingChecklistItem {
  key: keyof OnboardingStatus;
  label: string;
  href: string;
}

const CHECKLIST_ITEMS: OnboardingChecklistItem[] = [
  {
    key: 'business_name',
    label: 'Set up business profile',
    href: '/settings?tab=business',
  },
  {
    key: 'whatsapp_connected',
    label: 'Connect WhatsApp',
    href: '/settings?tab=integrations',
  },
  {
    key: 'staff_added',
    label: 'Add staff members',
    href: '/staff',
  },
  {
    key: 'services_created',
    label: 'Create services',
    href: '/services',
  },
  {
    key: 'templates_ready',
    label: 'Configure templates',
    href: '/settings?tab=templates',
  },
  {
    key: 'first_booking',
    label: 'Make first booking',
    href: '/bookings',
  },
];

export function OnboardingChecklist() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check localStorage for dismissed state
    const dismissedKey = 'onboarding-checklist-dismissed';
    const isDismissedLocal = localStorage.getItem(dismissedKey) === 'true';
    setIsDismissed(isDismissedLocal);

    // Load onboarding status
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.get<{ steps: OnboardingStatus }>('/business/onboarding-status');
      setStatus(data.steps);
    } catch (error) {
      console.error('Failed to load onboarding status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('onboarding-checklist-dismissed', 'true');
    setIsDismissed(true);
  };

  if (isDismissed || !status) {
    return null;
  }

  const completedCount = CHECKLIST_ITEMS.filter((item) => status[item.key]).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 mx-2 mb-2',
        ELEVATION.cardSm,
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Getting Started</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {completedCount} of {totalCount} steps done
          </p>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            'text-slate-400 dark:text-slate-500 transition-transform',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-sage-600 dark:bg-sage-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          <div className="px-4 py-3 space-y-2">
            {CHECKLIST_ITEMS.map((item) => {
              const isComplete = status[item.key];
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isComplete
                      ? 'bg-sage-50 dark:bg-sage-900/20 text-sage-700 dark:text-sage-400'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/30 text-slate-600 dark:text-slate-400',
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                      isComplete
                        ? 'bg-sage-600 dark:bg-sage-500'
                        : 'border border-slate-300 dark:border-slate-600',
                    )}
                  >
                    {isComplete && <Check size={14} className="text-white" />}
                  </div>
                  <span className={isComplete ? 'line-through' : ''}>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Dismiss button */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={handleDismiss}
              className="w-full flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 py-1.5 transition-colors"
            >
              <X size={12} />
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
