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
  const [approvalMode, setApprovalMode] = useState('review');
  const [roiBaseline, setRoiBaseline] = useState('');
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
        approvalMode,
        roiBaseline,
        autoReplySuggestions: true,
        autoReply: {
          enabled: false,
          mode: 'all',
          selectedIntents: ['GENERAL', 'BOOK_APPOINTMENT', 'CANCEL', 'RESCHEDULE', 'INQUIRY'],
          channelOverrides: Object.fromEntries(
            Object.entries(channels).map(([ch, enabled]) => [ch, { enabled }]),
          ),
        },
      });
      localStorage.setItem(STORAGE_KEY, 'true');
      setDone(true);
      toast('AI Front Desk is ready. Drafts will wait for staff approval.');
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
        <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2">
          AI Front Desk is ready!
        </h2>
        <p className="text-slate-500">
          Your AI Front Desk has been configured with staff approval on.
        </p>
      </div>
    );
  }

  const steps = [
    'Connect channels',
    'Set voice',
    'Approval mode',
    'Draft channels',
    'ROI baseline',
  ];

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
            <h2 className="text-xl font-serif font-bold text-slate-900">
              Connect front desk channels
            </h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            AI Front Desk works best once your customer channels are connected. Start with the
            inboxes where leads are easiest to miss.
          </p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-sage-500 flex-shrink-0" />
              Capture Instagram, WhatsApp, website chat, SMS, and email leads
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-sage-500 flex-shrink-0" />
              Draft replies for staff approval
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-sage-500 flex-shrink-0" />
              Fill cancelled slots and follow up consults
            </li>
          </ul>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">Set your voice</h2>
          <p className="text-sm text-slate-500">
            Describe how the AI Front Desk should communicate with your customers.
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
          <h2 className="text-xl font-serif font-bold text-slate-900">Choose approval mode</h2>
          <p className="text-sm text-slate-500">
            Staff approval is recommended for pilot clinics while tone, consent, and escalation
            rules are being learned.
          </p>
          <div className="space-y-3">
            {[
              { value: 'review', label: 'Draft for staff approval' },
              { value: 'suggest', label: 'Suggest next best action only' },
            ].map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <input
                  type="radio"
                  name="approvalMode"
                  value={option.value}
                  checked={approvalMode === option.value}
                  onChange={(e) => setApprovalMode(e.target.value)}
                  className="text-sage-600 focus:ring-sage-500"
                />
                <span className="text-sm font-medium text-slate-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">Choose draft channels</h2>
          <p className="text-sm text-slate-500">
            Select which channels can receive drafted replies. Auto-send stays off by default.
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

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">Set an ROI baseline</h2>
          <p className="text-sm text-slate-500">
            Add the revenue signal you want to watch first. You can refine it after setup.
          </p>
          <textarea
            value={roiBaseline}
            onChange={(e) => setRoiBaseline(e.target.value)}
            rows={4}
            placeholder="e.g., missed Instagram leads after hours, cancellation slots not filled, consult quotes not followed up."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lavender-500"
          />
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
              {saving ? 'Saving...' : 'Enable AI Front Desk'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
