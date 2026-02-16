'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { publicApi } from '@/lib/public-api';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface ClaimSummary {
  entry: {
    id: string;
    status: string;
    offeredSlot: { startTime: string; serviceName: string; staffName: string | null };
    offerExpiresAt: string;
    service: { id: string; name: string; durationMins: number; price: number };
    staff: { id: string; name: string } | null;
    customer: { name: string };
  };
  business: { id: string; name: string; slug: string };
}

export default function ClaimWaitlistPage() {
  const params = useParams();
  const token = params.token as string;

  const [summary, setSummary] = useState<ClaimSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    publicApi
      .get<ClaimSummary>(`/self-serve/validate/waitlist-claim/${token}`)
      .then(setSummary)
      .catch((err) => setError(err.message || 'Invalid or expired link'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await publicApi.post(`/self-serve/claim-waitlist/${token}`, {});
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to claim slot');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCFCFD] flex items-center justify-center">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FCFCFD] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-soft p-8 max-w-md w-full text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
            Unable to Claim
          </h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#FCFCFD] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-soft p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-sage-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-sage-600" />
          </div>
          <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
            Booking Confirmed!
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Your slot has been claimed and your booking is confirmed.
          </p>
          {summary && (
            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Service</span>
                <span className="font-medium text-slate-800">{summary.entry.service.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-800">
                  {new Date(summary.entry.offeredSlot.startTime).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time</span>
                <span className="font-medium text-slate-800">
                  {new Date(summary.entry.offeredSlot.startTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const slot = summary.entry.offeredSlot;
  const expiresAt = new Date(summary.entry.offerExpiresAt);

  return (
    <div className="min-h-screen bg-[#FCFCFD] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-soft p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl font-serif font-semibold text-slate-900">
            {summary.business.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">A slot has opened for you!</p>
        </div>

        <div className="bg-sage-50 rounded-xl p-4 space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-sage-700">Service</span>
            <span className="font-medium text-sage-900">{slot.serviceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sage-700">Date</span>
            <span className="font-medium text-sage-900">
              {new Date(slot.startTime).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sage-700">Time</span>
            <span className="font-medium text-sage-900">
              {new Date(slot.startTime).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
          {slot.staffName && (
            <div className="flex justify-between">
              <span className="text-sage-700">Staff</span>
              <span className="font-medium text-sage-900">{slot.staffName}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mb-4">
          <Clock size={14} />
          <span>
            This offer expires{' '}
            {expiresAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full bg-sage-600 hover:bg-sage-700 text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {claiming ? 'Claiming...' : 'Confirm Booking'}
        </button>
      </div>
    </div>
  );
}
