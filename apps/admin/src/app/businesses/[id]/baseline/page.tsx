'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { DetailSkeleton } from '@/components/skeleton';

interface Baseline {
  monthlyBookings: number | null;
  monthlyRevenue: number | null;
  capturedAt: string | null;
  source: string | null;
}

function toLocalDateTimeInputValue(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function BusinessBaselinePage() {
  const params = useParams();
  const businessId = (params?.id as string) || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [monthlyBookings, setMonthlyBookings] = useState('');
  const [monthlyRevenue, setMonthlyRevenue] = useState('');
  const [capturedAt, setCapturedAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [notes, setNotes] = useState('');

  const fetchBaseline = useCallback(async () => {
    setLoading(true);
    try {
      const baseline = await api.get<Baseline>(`/admin/businesses/${businessId}/baseline`);
      if (baseline.monthlyBookings !== null && baseline.monthlyBookings !== undefined) {
        setMonthlyBookings(String(baseline.monthlyBookings));
      }
      if (baseline.monthlyRevenue !== null && baseline.monthlyRevenue !== undefined) {
        setMonthlyRevenue(String(baseline.monthlyRevenue));
      }
      if (baseline.capturedAt) {
        setCapturedAt(toLocalDateTimeInputValue(new Date(baseline.capturedAt)));
      }
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to load baseline';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchBaseline();
  }, [fetchBaseline]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess(false);
    try {
      await api.patch(`/admin/businesses/${businessId}/baseline`, {
        monthlyBookings: monthlyBookings === '' ? null : Number(monthlyBookings),
        monthlyRevenue: monthlyRevenue === '' ? null : Number(monthlyRevenue),
        capturedAt: capturedAt ? new Date(capturedAt).toISOString() : null,
        notes: notes || null,
      });
      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to save baseline';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8" data-testid="loading">
        <DetailSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-2xl p-6 md:p-8">
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/businesses" className="transition-colors hover:text-sage-600">
          Businesses
        </Link>
        <ChevronRight size={14} />
        <Link href={`/businesses/${businessId}`} className="transition-colors hover:text-sage-600">
          Detail
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-slate-900 dark:text-white">Baseline</span>
      </nav>

      <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
        Pre-pilot Baseline
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Capture pre-pilot monthly bookings and revenue (founder concierge call). Used as the
        comparison anchor on the pilot-health page.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-2xl bg-white p-6 shadow-soft dark:bg-slate-900"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Monthly bookings (pre-pilot)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={monthlyBookings}
            onChange={(e) => setMonthlyBookings(e.target.value)}
            data-testid="baseline-monthly-bookings"
            className="w-full rounded-xl border-transparent bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-sage-500 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Monthly revenue (pre-pilot, USD)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={monthlyRevenue}
            onChange={(e) => setMonthlyRevenue(e.target.value)}
            data-testid="baseline-monthly-revenue"
            className="w-full rounded-xl border-transparent bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-sage-500 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Captured at
          </label>
          <input
            type="datetime-local"
            value={capturedAt}
            onChange={(e) => setCapturedAt(e.target.value)}
            data-testid="baseline-captured-at"
            className="w-full rounded-xl border-transparent bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-sage-500 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Notes (optional)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the founder learned during the concierge call (channels, tools, etc.)"
            data-testid="baseline-notes"
            className="w-full rounded-xl border-transparent bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-sage-500 dark:bg-slate-800 dark:text-white"
          />
          <p className="mt-1 text-xs text-slate-400">
            Notes are not yet persisted — capture them in your concierge-call log for now.
          </p>
        </div>

        {error && (
          <p
            data-testid="baseline-error"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            data-testid="baseline-success"
            className="rounded-xl bg-sage-50 px-3 py-2 text-sm text-sage-900"
          >
            Baseline saved.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            data-testid="baseline-submit"
            className="rounded-xl bg-sage-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sage-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save baseline'}
          </button>
        </div>
      </form>
    </div>
  );
}
