'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { publicApi } from '@/lib/public-api';
import { Calendar, Clock, User, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

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

interface TimeSlot {
  time: string;
  display: string;
  staffId: string;
  staffName: string;
  available: boolean;
}

type PageState = 'loading' | 'select' | 'confirming' | 'success' | 'error';

export default function ReschedulePage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<BookingSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Validate token on mount
  useEffect(() => {
    publicApi
      .get<BookingSummary>(`/self-serve/validate/reschedule/${token}`)
      .then((res) => {
        setData(res);
        setState('select');
      })
      .catch((err) => {
        setError(err.message || 'This link is invalid or has expired.');
        setState('error');
      });
  }, [token]);

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    publicApi
      .get<TimeSlot[]>(`/self-serve/availability/${token}?date=${selectedDate}`)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, token]);

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      await publicApi.post(`/self-serve/reschedule/${token}`, {
        startTime: selectedSlot.time,
        staffId: selectedSlot.staffId,
      });
      setState('success');
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule. Please try again.');
      setState('error');
    }
    setSubmitting(false);
  };

  // Generate next 30 days for date picker
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split('T')[0];
  });

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center py-16">
        <AlertTriangle size={48} className="mx-auto text-orange-400 mb-4" />
        <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
          Unable to Reschedule
        </h1>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{error}</p>
        <p className="text-sm text-slate-400">Please contact the clinic directly for assistance.</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="text-center py-16">
        <CheckCircle size={48} className="mx-auto text-sage-500 mb-4" />
        <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
          Appointment Rescheduled
        </h1>
        <p className="text-slate-500 mb-2">
          Your {data?.booking.service.name} has been moved to the new time.
        </p>
        {selectedSlot && (
          <p className="text-sm font-medium text-sage-700">
            {new Date(selectedSlot.time).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}{' '}
            at {selectedSlot.display}
          </p>
        )}
        <p className="text-sm text-slate-400 mt-4">You can close this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Reschedule Appointment</h1>
        {data?.business && <p className="text-sm text-slate-500 mt-1">{data.business.name}</p>}
      </div>

      {/* Current booking summary */}
      {data?.booking && (
        <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase">Current Appointment</p>
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

      {/* Date picker */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Select a new date</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((date) => {
            const d = new Date(date + 'T12:00:00');
            const isSelected = selectedDate === date;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'flex-shrink-0 w-16 py-2 rounded-xl text-center transition-colors',
                  isSelected
                    ? 'bg-sage-600 text-white'
                    : 'bg-white border border-slate-200 hover:border-sage-300 text-slate-700',
                )}
              >
                <div className="text-[10px] uppercase">
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="text-lg font-semibold">{d.getDate()}</div>
                <div className="text-[10px]">
                  {d.toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Available times</p>
          {loadingSlots ? (
            <p className="text-sm text-slate-400 animate-pulse">Loading available times...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-slate-400">
              No times available on this day. Try another date.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot, i) => {
                const isSelected =
                  selectedSlot?.time === slot.time && selectedSlot?.staffId === slot.staffId;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedSlot(slot)}
                    className={cn(
                      'py-2 px-3 rounded-xl text-sm font-medium transition-colors',
                      isSelected
                        ? 'bg-sage-600 text-white'
                        : 'bg-white border border-slate-200 hover:border-sage-300 text-slate-700',
                    )}
                  >
                    {slot.display}
                    {slot.staffName && (
                      <div className="text-[10px] font-normal mt-0.5 truncate">
                        {slot.staffName}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirm button */}
      {selectedSlot && (
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full py-3 bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {submitting ? 'Rescheduling...' : 'Confirm New Time'}
        </button>
      )}
    </div>
  );
}
