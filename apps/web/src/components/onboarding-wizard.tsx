'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Check, Building2, Scissors, Users, Clock, Globe, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';

interface OnboardingStatus {
  business_name: boolean;
  whatsapp_connected: boolean;
  staff_added: boolean;
  services_created: boolean;
  first_booking: boolean;
}

interface WizardStep {
  key: keyof OnboardingStatus;
  title: string;
  description: string;
  href: string;
  icon: typeof Building2;
}

export interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingWizard({ isOpen, onClose }: OnboardingWizardProps) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const slug = user?.business?.slug || '';

  const steps: WizardStep[] = [
    {
      key: 'business_name',
      title: 'Business Profile',
      description: 'Set up your business name, logo, and contact info',
      href: '/settings',
      icon: Building2,
    },
    {
      key: 'services_created',
      title: 'Services',
      description: 'Add at least one service with name, duration, and price',
      href: '/services',
      icon: Scissors,
    },
    {
      key: 'staff_added',
      title: 'Team',
      description: 'Invite or add team members',
      href: '/staff',
      icon: Users,
    },
    {
      key: 'whatsapp_connected',
      title: 'Availability',
      description: 'Set your business hours and staff schedules',
      href: '/settings',
      icon: Clock,
    },
    {
      key: 'first_booking',
      title: 'Booking Portal',
      description: 'Preview and customize your public booking page',
      href: slug ? `/book/${slug}` : '/settings',
      icon: Globe,
    },
  ];

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    api
      .get<{ steps: OnboardingStatus }>('/business/onboarding-status')
      .then((data) => setStatus(data.steps))
      .catch(() =>
        setStatus({
          business_name: false,
          whatsapp_connected: false,
          staff_added: false,
          services_created: false,
          first_booking: false,
        }),
      )
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const completedCount = status ? steps.filter((step) => status[step.key]).length : 0;
  const totalCount = steps.length;
  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="onboarding-wizard"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        data-testid="wizard-backdrop"
      />

      {/* Card */}
      <div className="relative w-full max-w-xl mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-serif font-semibold text-slate-900 dark:text-slate-100">
              Complete Your Setup
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {completedCount} of {totalCount} steps completed
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close wizard"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-4">
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-sage-600 dark:bg-sage-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              data-testid="wizard-progress-bar"
            />
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 pb-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading...</div>
          ) : (
            <div className="space-y-1">
              {steps.map((step, index) => {
                const isComplete = status ? status[step.key] : false;
                const StepIcon = step.icon;

                return (
                  <div
                    key={step.key}
                    className="flex items-start gap-4 py-3"
                    data-testid={`wizard-step-${step.key}`}
                  >
                    {/* Step indicator with connector lines */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                          isComplete
                            ? 'bg-sage-600 dark:bg-sage-500'
                            : 'border-2 border-slate-300 dark:border-slate-600',
                        )}
                      >
                        {isComplete ? (
                          <Check size={16} className="text-white" />
                        ) : (
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={cn(
                            'w-0.5 h-8 mt-1',
                            isComplete
                              ? 'bg-sage-300 dark:bg-sage-700'
                              : 'bg-slate-200 dark:bg-slate-700',
                          )}
                        />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <StepIcon
                          size={16}
                          className={cn(
                            isComplete
                              ? 'text-sage-600 dark:text-sage-400'
                              : 'text-slate-400 dark:text-slate-500',
                          )}
                        />
                        <h3
                          className={cn(
                            'text-sm font-medium',
                            isComplete
                              ? 'text-sage-700 dark:text-sage-400'
                              : 'text-slate-800 dark:text-slate-200',
                          )}
                        >
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {step.description}
                      </p>
                      {!isComplete && (
                        <Link
                          href={step.href}
                          className="inline-block text-xs font-medium text-sage-600 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-300 bg-sage-50 dark:bg-sage-900/20 hover:bg-sage-100 dark:hover:bg-sage-900/30 px-3 py-1.5 rounded-xl transition-colors"
                          onClick={onClose}
                        >
                          Complete Setup
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={onClose}
            className="w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 py-2 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
