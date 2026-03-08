'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { trackEvent } from '@/lib/posthog';
import { X } from 'lucide-react';

const NPS_DELAY_DAYS = 30;
const NPS_STORAGE_KEY = 'nps-survey-completed';

export function NpsSurvey() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.business?.createdAt) return;

    // Don't show if already completed or dismissed
    if (typeof window !== 'undefined' && localStorage.getItem(NPS_STORAGE_KEY)) {
      return;
    }

    // Don't show if NPS already submitted (stored in packConfig)
    const packConfig = user.business.packConfig as Record<string, unknown> | null;
    if (packConfig?.npsResponse) {
      return;
    }

    // Check if business is at least 30 days old
    const createdAt = new Date(user.business.createdAt);
    const now = new Date();
    const daysSinceCreation = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceCreation >= NPS_DELAY_DAYS) {
      setVisible(true);
    }
  }, [user]);

  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NPS_STORAGE_KEY, 'dismissed');
    }
    trackEvent('nps_dismissed', {
      businessId: user?.businessId,
      daysSinceCreation: user?.business?.createdAt
        ? Math.floor(
            (Date.now() - new Date(user.business.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          )
        : undefined,
    });
  };

  const handleSubmit = async () => {
    if (score === null || submitting) return;

    setSubmitting(true);
    try {
      await api.post('/business/nps', { score, feedback: feedback || undefined });
      trackEvent('nps_submitted', {
        score,
        hasFeedback: feedback.length > 0,
        businessId: user?.businessId,
      });
      setSubmitted(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(NPS_STORAGE_KEY, 'submitted');
      }
      // Auto-close after showing thank you
      setTimeout(() => setVisible(false), 2000);
    } catch {
      // Silently handle — don't block the user
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30 animate-fade-in"
        onClick={handleDismiss}
        data-testid="nps-backdrop"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        data-testid="nps-survey"
      >
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full pointer-events-auto animate-scale-in">
          {submitted ? (
            <div className="p-8 text-center" data-testid="nps-thank-you">
              <p className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-100">
                Thank you!
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Your feedback helps us improve Booking OS.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-2">
                <h2 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-100">
                  Quick feedback
                </h2>
                <button
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  aria-label="Dismiss survey"
                  data-testid="nps-dismiss"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Question */}
              <div className="px-6 pb-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  How likely are you to recommend Booking OS to a colleague?
                </p>
              </div>

              {/* Score buttons */}
              <div className="px-6 pb-2">
                <div className="flex gap-1" data-testid="nps-scores">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setScore(i)}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                        score === i
                          ? 'bg-sage-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      aria-label={`Score ${i}`}
                      data-testid={`nps-score-${i}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-400">Not likely</span>
                  <span className="text-[10px] text-slate-400">Very likely</span>
                </div>
              </div>

              {/* Feedback text area */}
              <div className="px-6 pb-4">
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Any additional feedback? (optional)"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-sage-500 rounded-xl text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 p-3 resize-none"
                  rows={2}
                  maxLength={500}
                  data-testid="nps-feedback"
                />
              </div>

              {/* Submit */}
              <div className="px-6 pb-6">
                <button
                  onClick={handleSubmit}
                  disabled={score === null || submitting}
                  className="w-full py-2.5 bg-sage-600 hover:bg-sage-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors"
                  data-testid="nps-submit"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
