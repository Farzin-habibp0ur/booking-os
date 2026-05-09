'use client';

import { useState } from 'react';
import { Sparkles, ChevronRight, CheckCircle, X } from 'lucide-react';

const STORAGE_KEY = 'bookingos:automation-onboarding-done';

interface OnboardingGuideProps {
  playbooks: any[];
  onActivatePlaybook: (id: string) => Promise<void>;
}

export function OnboardingGuide({ playbooks, onActivatePlaybook }: OnboardingGuideProps) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true',
  );
  const [step, setStep] = useState<'intro' | 'recommend' | 'success'>('intro');
  const [activating, setActivating] = useState(false);

  const hasActivePlaybook = playbooks.some((p) => p.isActive);
  if (dismissed || hasActivePlaybook) return null;

  const recommended = playbooks.find((p) => p.playbook === 'no-show-prevention') || playbooks[0];

  const handleActivate = async () => {
    if (!recommended) return;
    setActivating(true);
    try {
      await onActivatePlaybook(recommended.playbook);
      setStep('success');
    } finally {
      setActivating(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div
      className="bg-gradient-to-r from-sage-50 to-lavender-50 rounded-2xl p-6 mb-6 border border-sage-100"
      data-testid="onboarding-guide"
    >
      {step === 'intro' && (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={18} className="text-sage-600" />
              <h3 className="text-sm font-semibold text-slate-900">Get started with automations</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 max-w-md">
              Automations save you time by handling routine tasks automatically. We recommend
              starting with a popular playbook.
            </p>
            <button
              onClick={() => setStep('recommend')}
              className="flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
            >
              Get started <ChevronRight size={14} />
            </button>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {step === 'recommend' && recommended && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            We recommend: {recommended.name}
          </h3>
          <p className="text-xs text-slate-600 mb-4">{recommended.description}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleActivate}
              disabled={activating}
              className="flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
              data-testid="activate-recommended"
            >
              {activating ? 'Activating...' : 'Activate'}
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="flex items-center gap-3">
          <CheckCircle size={24} className="text-sage-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Your first automation is live!</h3>
            <p className="text-xs text-slate-600">
              {recommended?.name} is now active and will start running automatically.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="ml-auto px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
