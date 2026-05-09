'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Sparkles, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

// Step 1 channels per BCC-PIVOT-MASTER-PLAN.md v3 Phase 6 spec:
//   Instagram, WhatsApp, web chat, SMS, email (Facebook Messenger excluded from concierge default)
const CHANNELS = ['INSTAGRAM', 'WHATSAPP', 'WEB_CHAT', 'SMS', 'EMAIL'] as const;
const STORAGE_KEY = 'bookingos:ai-setup-dismissed';

interface Props {
  onComplete?: () => void;
}

interface BusinessSummary {
  baselineMonthlyBookings: number | null;
}

export function AISetupWizard({ onComplete }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [personality, setPersonality] = useState('');
  // Step 3: explicit confirmation that approval mode stays ON (autoReply.enabled = false)
  const [approvalConfirmed, setApprovalConfirmed] = useState(true);
  // Step 4: waitlist + cancellation fill toggles (turned on by default)
  const [waitlistFillEnabled, setWaitlistFillEnabled] = useState(true);
  const [cancellationFillEnabled, setCancellationFillEnabled] = useState(true);
  // Step 5: baseline is read-only — the founder sets it during the concierge call
  const [baseline, setBaseline] = useState<number | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(true);
  const [channels, setChannels] = useState<Record<string, boolean>>(
    Object.fromEntries(CHANNELS.map((ch) => [ch, true])),
  );
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Fetch baseline from /business (set by founder during concierge call)
  useEffect(() => {
    let cancelled = false;
    api
      .get<BusinessSummary>('/business')
      .then((b) => {
        if (cancelled) return;
        setBaseline(
          typeof b?.baselineMonthlyBookings === 'number' ? b.baselineMonthlyBookings : null,
        );
      })
      .catch(() => {
        if (!cancelled) setBaseline(null);
      })
      .finally(() => {
        if (!cancelled) setBaselineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        // Approval mode is locked ON during concierge pilot (autoReply.enabled = false).
        approvalMode: 'review',
        autoReplySuggestions: true,
        autoReply: {
          enabled: false,
          mode: 'all',
          selectedIntents: ['GENERAL', 'BOOK_APPOINTMENT', 'CANCEL', 'RESCHEDULE', 'INQUIRY'],
          channelOverrides: Object.fromEntries(
            Object.entries(channels).map(([ch, enabled]) => [ch, { enabled }]),
          ),
        },
        // Operational agent toggles for the wedge: waitlist auto-match + cancellation fill
        agents: {
          waitlistFillEnabled,
          cancellationFillEnabled,
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
    'Fill cancellations',
    'Confirm baseline',
  ];

  // Channel display labels
  const channelLabels: Record<string, string> = {
    INSTAGRAM: 'Instagram',
    WHATSAPP: 'WhatsApp',
    WEB_CHAT: 'Website chat',
    SMS: 'SMS',
    EMAIL: 'Email',
  };

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

      {/* Step 1: Connect channels (Instagram, WhatsApp, web chat, SMS, email) */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={24} className="text-lavender-600" />
            <h2 className="text-xl font-serif font-bold text-slate-900">
              Connect front desk channels
            </h2>
          </div>
          <p className="text-sm text-slate-500">
            AI Front Desk drafts replies for each channel where leads arrive. Toggle off any channel
            you do not want the AI to handle.
          </p>
          <div className="space-y-3">
            {CHANNELS.map((ch) => (
              <label key={ch} className="flex items-center justify-between py-2 cursor-pointer">
                <span className="text-sm font-medium text-slate-700">{channelLabels[ch]}</span>
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

      {/* Step 2: Set clinic voice */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">Set your clinic voice</h2>
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

      {/* Step 3: Confirm approval mode ON (locks autoReply.enabled = false) */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">
            Confirm approval mode is ON
          </h2>
          <p className="text-sm text-slate-500">
            During the concierge pilot, every AI reply waits for staff approval before sending. This
            stays on while we learn your tone, consent rules, and escalation patterns.
          </p>
          <label className="flex items-start gap-3 rounded-xl border border-lavender-100 bg-lavender-50 p-4">
            <input
              type="checkbox"
              checked={approvalConfirmed}
              onChange={(e) => setApprovalConfirmed(e.target.checked)}
              className="mt-0.5 text-sage-600 focus:ring-sage-500"
              data-testid="approval-confirm"
            />
            <span className="text-sm text-slate-700">
              I understand AI drafts will not auto-send. Staff approves every outgoing message
              (autoReply.enabled = false).
            </span>
          </label>
        </div>
      )}

      {/* Step 4: Enable waitlist + cancellation fill */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">
            Enable waitlist + cancellation fill
          </h2>
          <p className="text-sm text-slate-500">
            When a booking cancels, the AI matches your waitlist and drafts an offer. Staff approves
            the message before it sends.
          </p>
          <div className="space-y-3">
            <label className="flex items-center justify-between py-2 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">Waitlist auto-match</span>
              <button
                type="button"
                onClick={() => setWaitlistFillEnabled((v) => !v)}
                className={cn(
                  'relative w-9 h-5 rounded-full transition-colors',
                  waitlistFillEnabled ? 'bg-sage-500' : 'bg-slate-200',
                )}
                role="switch"
                aria-checked={waitlistFillEnabled}
                data-testid="waitlist-fill-toggle"
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    waitlistFillEnabled ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>
            </label>
            <label className="flex items-center justify-between py-2 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">Cancellation fill</span>
              <button
                type="button"
                onClick={() => setCancellationFillEnabled((v) => !v)}
                className={cn(
                  'relative w-9 h-5 rounded-full transition-colors',
                  cancellationFillEnabled ? 'bg-sage-500' : 'bg-slate-200',
                )}
                role="switch"
                aria-checked={cancellationFillEnabled}
                data-testid="cancellation-fill-toggle"
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                    cancellationFillEnabled ? 'translate-x-4' : 'translate-x-0',
                  )}
                />
              </button>
            </label>
          </div>
        </div>
      )}

      {/* Step 5: Confirm baseline (read-only — set by founder during concierge call) */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-900">
            Confirm your pre-pilot baseline
          </h2>
          <p className="text-sm text-slate-500">
            Your baseline was captured during the concierge call. The dashboard uses it to compute
            booking lift. To change it, contact your concierge.
          </p>
          <div
            className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex items-baseline justify-between"
            data-testid="baseline-display"
          >
            <span className="text-sm text-slate-500">Monthly bookings (baseline)</span>
            <span className="text-2xl font-serif text-slate-900">
              {baselineLoading ? '…' : baseline === null ? 'Not set' : baseline}
            </span>
          </div>
          {baseline === null && !baselineLoading && (
            <p className="text-xs text-slate-400">
              No baseline yet — your concierge will set this before go-live.
            </p>
          )}
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
              disabled={step === 2 && !approvalConfirmed}
              className="px-4 py-2 text-sm bg-lavender-600 text-white rounded-xl hover:bg-lavender-700 transition-colors disabled:opacity-50"
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
