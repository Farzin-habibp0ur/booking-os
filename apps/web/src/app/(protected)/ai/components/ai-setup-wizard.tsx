'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Sparkles, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'SMS', 'EMAIL', 'WEB_CHAT'] as const;
const STORAGE_KEY = 'bookingos:ai-setup-dismissed';

interface Props {
  onComplete?: () => void;
}

export function AISetupWizard({ onComplete }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [personality, setPersonality] = useState('');
  const [channels, setChannels] = useState<Record<string, boolean>>(
    Object.fromEntries(CHANNELS.map((ch) => [ch, true])),
  );
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await api.patch('/ai/settings', {
        enabled: true,
        personality,
        autoReply: {
          channelOverrides: Object.fromEntries(
            Object.entries(channels).map(([ch, enabled]) => [ch, { enabled }]),
          ),
        },
      });
      localStorage.setItem(STORAGE_KEY, 'true');
      setDone(true);
      toast('AI is ready! Your assistant is now active.');
      setTimeout(() => onComplete?.(), 1500);
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setChannels((prev) => ({ ...prev, [ch]: !prev[ch] }));
  };

  if (done) {
    return (
      <div
        className="bg-white rounded-2xl shadow-soft p-8 max-w-2xl mx-auto text-center"
        data-testid="ai-setup-wizard"
      >
        <CheckCircle size={48} className="text-sage-500 mx-auto mb-4" />
        <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2">AI is ready!</h2>
        <p className="text-slate-500">Your AI assistant has been configured and is now active.</p>
      </div>
    );
  }

  const steps = ['Enable AI', 'Set your voice', 'Choose channels'];

  return (
    <div
      className="bg-white rounded-2xl shadow-soft p-8 max-w-2xl mx-auto"
      data-testid="ai-setup-wizard"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                i < step
                  ? 'bg-sage-600 text-white'
                  : i === step
                    ? 'bg-lavender-600 text-white'
                    : 'bg-slate-100 text-slate-400',
              )}
              data-testid={`step-indicator-${i}`}
            >
              {i < step ? <CheckCircle size={16} /> : i + 1}
            </div>
            <span
              className={cn(
                'text-sm font-medium hidden sm:block',
                i === step ? 'text-slate-900' : 'text-slate-400',
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={cn('flex-1 h-px mx-2', i < step ? 'bg-sage-300' : 'bg-slate-200')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={24} className="text-lavender-600" />
            <h2 className="text-xl font-serif font-bold text-slate-900">Enable AI</h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            AI will help you respond to customers faster, fill cancelled appointment slots, and
            identify at-risk patients.
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-sage-500 flex-shrink-0" />
              Auto-reply to common messages 24/7
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-sage-500 flex-shrink-0" />
              Fill cancelled slots from your waitlist
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-sage-500 flex-shrink-0" />
              Identify at-risk patients before they churn
            </li>
          </ul>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">Set your voice</h2>
          <p className="text-sm text-slate-500">
            Describe how you'd like AI to communicate with your customers.
          </p>
          <textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            rows={4}
            placeholder="e.g., Friendly and professional. Always mention our 24-hour cancellation policy."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lavender-500"
            data-testid="personality-input"
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">Choose channels</h2>
          <p className="text-sm text-slate-500">
            Select which channels AI can auto-reply on. You can change these later.
          </p>
          <div className="space-y-3">
            {CHANNELS.map((ch) => (
              <label key={ch} className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-sm font-medium text-slate-700">{ch.replace(/_/g, ' ')}</span>
                <button
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={cn(
                    'relative w-9 h-5 rounded-full transition-colors',
                    channels[ch] ? 'bg-sage-500' : 'bg-slate-200',
                  )}
                  role="switch"
                  aria-checked={channels[ch]}
                  data-testid={`channel-toggle-${ch}`}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                      channels[ch] ? 'translate-x-4' : 'translate-x-0',
                    )}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          data-testid="skip-button"
        >
          Skip for now
        </button>
        <div className="flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              data-testid="back-button"
            >
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 text-sm bg-lavender-600 text-white rounded-xl hover:bg-lavender-700 transition-colors"
              data-testid="next-button"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving}
              className="px-4 py-2 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
              data-testid="complete-button"
            >
              {saving ? 'Saving...' : 'Enable AI'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
