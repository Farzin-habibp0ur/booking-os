'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { publicApi } from '@/lib/public-api';
import { Calendar, Clock, User, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SelfServeError } from '@/components/self-serve-error';

interface BookingSummary {
  booking: {
    id: string;
    status: string;
    startTime: string;
    endTime: string;
    service: { id: string; name: string; durationMins: number; price: number };
    staff: { id: string; name: string } | null;
    customer: { name: string };
  };
  business: { id: string; name: string; slug: string };
  policyText?: string;
}

type PageState = 'loading' | 'confirm' | 'submitting' | 'success' | 'error';

export default function CancelPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<BookingSummary | null>(null);
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    publicApi
      .get<BookingSummary>(`/self-serve/validate/cancel/${token}`)
      .then((res) => {
        setData(res);
        setState('confirm');
      })
      .catch((err) => {
        setError(err.message || 'This link is invalid or has expired.');
        setState('error');
      });
  }, [token]);

  const handleCancel = async () => {
    setState('submitting');
    try {
      await publicApi.post(`/self-serve/cancel/${token}`, {
        reason: reason.trim() || undefined,
      });
      setState('success');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel. Please try again.');
      setState('error');
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <SelfServeError
        title="Unable to Cancel"
        message={error || 'This link is invalid or has expired.'}
        businessName={data?.business?.name}
        businessSlug={data?.business?.slug}
      />
    );
  }

  if (state === 'success') {
    return (
      <div className="text-center py-16">
        <CheckCircle size={48} className="mx-auto text-sage-500 mb-4" />
        <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
          Appointment Cancelled
        </h1>
        <p className="text-slate-500 mb-2">
          Your {data?.booking.service.name} appointment has been cancelled.
        </p>
        <div
          className="bg-sage-50 rounded-xl p-3 text-left max-w-sm mx-auto mb-2"
          data-testid="what-happens-next"
        >
          <p className="text-xs font-medium text-sage-700 mb-1.5">What happens next</p>
          <ul className="text-xs text-sage-600 space-y-1">
            <li>Your time slot has been released</li>
            <li>If applicable, any deposit will be handled per the cancellation policy</li>
          </ul>
        </div>
        {data?.business?.slug && (
          <a
            href={`/book/${data.business.slug}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors mt-2"
          >
            Book Again
          </a>
        )}
        <p className="text-sm text-slate-400 mt-4">You can close this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Cancel Appointment</h1>
        {data?.business && <p className="text-sm text-slate-500 mt-1">{data.business.name}</p>}
      </div>

      {/* Booking summary */}
      {data?.booking && (
        <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase">Appointment Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-slate-400" />
              <span>
                {new Date(data.booking.startTime).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} className="text-slate-400" />
              <span>
                {new Date(data.booking.startTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">{data.booking.service.name}</span>
            </div>
            {data.booking.staff && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-slate-400" />
                <span>{data.booking.staff.name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Policy text */}
      {data?.policyText && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm text-orange-700">
          {data.policyText}
        </div>
      )}

      {/* Reason textarea */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Reason for cancellation (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Let us know why you need to cancel..."
          rows={3}
          className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm resize-none"
        />
      </div>

      {/* Cancel button with confirmation step */}
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
        >
          Cancel Appointment
        </button>
      ) : (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <p className="text-sm font-medium text-red-800">Are you sure you want to cancel?</p>
          </div>
          <p className="text-sm text-red-600">
            This action cannot be undone. You will need to book a new appointment.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 border border-slate-200 rounded-xl text-sm hover:bg-white transition-colors"
            >
              Go Back
            </button>
            <button
              onClick={handleCancel}
              disabled={state === 'submitting'}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {state === 'submitting' ? 'Cancelling...' : 'Yes, Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
