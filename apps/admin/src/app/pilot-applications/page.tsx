'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ClipboardList, Search } from 'lucide-react';
import { ListSkeleton } from '@/components/skeleton';

type PilotStatus = 'NEW' | 'CONTACTED' | 'ACCEPTED' | 'REJECTED' | 'WAITLIST_YEAR_2';

interface PilotApplication {
  id: string;
  clinicName: string;
  contactName: string;
  email: string;
  phone: string | null;
  websiteOrInstagram: string | null;
  countryTimezone: string | null;
  monthlyLeadVolume: string | null;
  currentChannels: string[];
  practiceType: string | null;
  biggestFrontDeskPain: string;
  consent: boolean;
  status: PilotStatus;
  notes: string | null;
  acceptedBusinessId: string | null;
  submittedAt: string;
}

interface ListResponse {
  items: PilotApplication[];
  total: number;
  page: number;
  pageSize: number;
}

interface AcceptResponse {
  businessId: string;
  ownerStaffId: string;
  setupTokenSent: boolean;
}

const STATUSES: PilotStatus[] = ['NEW', 'CONTACTED', 'ACCEPTED', 'REJECTED', 'WAITLIST_YEAR_2'];

const STATUS_STYLES: Record<PilotStatus, string> = {
  NEW: 'bg-lavender-50 text-lavender-900',
  CONTACTED: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-sage-50 text-sage-900',
  REJECTED: 'bg-slate-100 text-slate-600',
  WAITLIST_YEAR_2: 'bg-slate-200 text-slate-700',
};

const TRIAGE_STATUSES: PilotStatus[] = ['NEW', 'CONTACTED'];

export default function PilotApplicationsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [actionState, setActionState] = useState<
    Record<string, { kind: 'accepted'; businessId: string } | { kind: 'error'; message: string }>
  >({});

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      params.set('pageSize', '50');
      const result = await api.get<ListResponse>(`/admin/pilot-applications?${params}`);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch pilot applications', err);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timer = setTimeout(() => fetchApplications(), 250);
    return () => clearTimeout(timer);
  }, [fetchApplications]);

  const updateStatus = async (id: string, nextStatus: PilotStatus) => {
    setUpdatingId(id);
    try {
      await api.patch(`/admin/pilot-applications/${id}`, { status: nextStatus });
      await fetchApplications();
    } finally {
      setUpdatingId('');
    }
  };

  const acceptAndProvision = async (id: string) => {
    setUpdatingId(id);
    setActionState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const result = await api.patch<AcceptResponse>(`/admin/pilot-applications/${id}/accept`, {});
      setActionState((prev) => ({
        ...prev,
        [id]: { kind: 'accepted', businessId: result.businessId },
      }));
      await fetchApplications();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Failed to accept and provision';
      setActionState((prev) => ({ ...prev, [id]: { kind: 'error', message } }));
    } finally {
      setUpdatingId('');
    }
  };

  const moveToYear2Waitlist = async (id: string) => {
    setUpdatingId(id);
    setActionState((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      await api.patch(`/admin/pilot-applications/${id}/waitlist-year-2`, {});
      await fetchApplications();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Failed to update waitlist';
      setActionState((prev) => ({ ...prev, [id]: { kind: 'error', message } }));
    } finally {
      setUpdatingId('');
    }
  };

  const formatPracticeType = (value: string | null) =>
    value
      ? value
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : '—';

  return (
    <div className="max-w-7xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
            Pilot Applications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review clinics applying for the AI Front Desk pilot.
          </p>
        </div>
        <span className="rounded-full bg-sage-50 px-3 py-1 text-sm font-medium text-sage-900">
          {data?.total ?? 0} total
        </span>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clinic, contact, email, or website..."
            className="w-full rounded-xl border-transparent bg-slate-50 py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-sage-500 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border-transparent bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-sage-500 dark:bg-slate-800 dark:text-slate-300"
        >
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-soft dark:bg-slate-900">
        {loading ? (
          <div className="p-4">
            <ListSkeleton rows={6} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="mx-auto mb-4 text-slate-300" size={48} />
            <p className="text-sm text-slate-500">No pilot applications found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.items.map((application) => {
              const isTriage = TRIAGE_STATUSES.includes(application.status);
              const isMedSpa = application.practiceType === 'MED_SPA';
              const showAccept = isTriage && isMedSpa;
              const showWaitlistYear2 = isTriage && !isMedSpa;
              const state = actionState[application.id];
              return (
                <article key={application.id} className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {application.clinicName}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLES[application.status]
                        }`}
                      >
                        {application.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {formatPracticeType(application.practiceType)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {application.contactName} · {application.email}
                      {application.phone ? ` · ${application.phone}` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {application.currentChannels.map((channel) => (
                        <span
                          key={channel}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {channel.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {application.monthlyLeadVolume && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {application.monthlyLeadVolume.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {application.biggestFrontDeskPain}
                    </p>
                    {application.websiteOrInstagram && (
                      <p className="mt-3 text-sm text-slate-500">
                        {application.websiteOrInstagram}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-slate-400">
                      Submitted {new Date(application.submittedAt).toLocaleDateString()}
                    </p>

                    {showAccept && (
                      <button
                        type="button"
                        disabled={updatingId === application.id}
                        onClick={() => acceptAndProvision(application.id)}
                        data-testid={`accept-${application.id}`}
                        className="rounded-xl bg-sage-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sage-700 disabled:opacity-50"
                      >
                        {updatingId === application.id ? 'Provisioning…' : 'Accept and Provision'}
                      </button>
                    )}

                    {showWaitlistYear2 && (
                      <button
                        type="button"
                        disabled={updatingId === application.id}
                        onClick={() => moveToYear2Waitlist(application.id)}
                        data-testid={`waitlist-year-2-${application.id}`}
                        className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                      >
                        {updatingId === application.id ? 'Saving…' : 'Add to Year 2 Waitlist'}
                      </button>
                    )}

                    {state?.kind === 'accepted' && (
                      <Link
                        href={`/businesses/${state.businessId}`}
                        data-testid={`provisioned-link-${application.id}`}
                        className="rounded-xl bg-sage-50 px-3 py-2 text-center text-xs font-medium text-sage-900 hover:bg-sage-100"
                      >
                        Pilot provisioned — open business
                      </Link>
                    )}
                    {application.acceptedBusinessId && state?.kind !== 'accepted' && (
                      <Link
                        href={`/businesses/${application.acceptedBusinessId}`}
                        className="rounded-xl bg-sage-50 px-3 py-2 text-center text-xs font-medium text-sage-900 hover:bg-sage-100"
                      >
                        Open provisioned business
                      </Link>
                    )}
                    {state?.kind === 'error' && (
                      <p
                        data-testid={`error-${application.id}`}
                        className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
                      >
                        {state.message}
                      </p>
                    )}

                    <select
                      value={application.status}
                      disabled={updatingId === application.id}
                      onChange={(e) => updateStatus(application.id, e.target.value as PilotStatus)}
                      className="rounded-xl border-transparent bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:ring-2 focus:ring-sage-500 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
