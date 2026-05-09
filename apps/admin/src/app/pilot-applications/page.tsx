'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ClipboardList, Search } from 'lucide-react';
import { ListSkeleton } from '@/components/skeleton';

type PilotStatus = 'NEW' | 'CONTACTED' | 'ACCEPTED' | 'REJECTED';

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
  biggestFrontDeskPain: string;
  consent: boolean;
  status: PilotStatus;
  notes: string | null;
  submittedAt: string;
}

interface ListResponse {
  items: PilotApplication[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUSES: PilotStatus[] = ['NEW', 'CONTACTED', 'ACCEPTED', 'REJECTED'];

const STATUS_STYLES: Record<PilotStatus, string> = {
  NEW: 'bg-lavender-50 text-lavender-900',
  CONTACTED: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-sage-50 text-sage-900',
  REJECTED: 'bg-slate-100 text-slate-600',
};

export default function PilotApplicationsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [updatingId, setUpdatingId] = useState('');

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
            {data.items.map((application) => (
              <article key={application.id} className="grid gap-5 p-5 lg:grid-cols-[1fr_220px]">
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
                    <p className="mt-3 text-sm text-slate-500">{application.websiteOrInstagram}</p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-xs text-slate-400">
                    Submitted {new Date(application.submittedAt).toLocaleDateString()}
                  </p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
