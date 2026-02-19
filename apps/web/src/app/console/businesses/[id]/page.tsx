'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  ChevronRight,
  Globe,
  Calendar,
  Users,
  MessageSquare,
  ClipboardList,
  Megaphone,
  Bot,
  Eye,
} from 'lucide-react';

interface BusinessDetail {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  verticalPack: string;
  packConfig: Record<string, unknown>;
  defaultLocale: string;
  createdAt: string;
  owner: { email: string; name: string } | null;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
  health: string;
  lastActive: string | null;
  counts: {
    bookings: number;
    customers: number;
    conversations: number;
    staff: number;
    services: number;
    campaigns: number;
    waitlistEntries: number;
  };
}

interface UsageSnapshot {
  bookings7d: number;
  bookings30d: number;
  conversations: number;
  waitlistEntries: number;
  campaigns: number;
  agentRuns: number;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const HEALTH_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  green: { label: 'Healthy', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  yellow: { label: 'Needs Attention', color: 'text-amber-700', bg: 'bg-amber-50' },
  red: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50' },
};

const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-lavender-50 text-lavender-700',
  SERVICE_PROVIDER: 'bg-sage-50 text-sage-700',
  AGENT: 'bg-slate-100 text-slate-700',
};

export default function Business360Page() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.id as string;

  const [tab, setTab] = useState<'summary' | 'people'>('summary');
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSummary = useCallback(async () => {
    try {
      const [bizData, usageData] = await Promise.all([
        api.get<BusinessDetail>(`/admin/businesses/${businessId}`),
        api.get<UsageSnapshot>(`/admin/businesses/${businessId}/usage`),
      ]);
      setBusiness(bizData);
      setUsage(usageData);
    } catch (err: any) {
      setError(err.message || 'Failed to load business');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const fetchStaff = useCallback(async () => {
    if (staff) return; // Already loaded
    try {
      const data = await api.get<StaffMember[]>(
        `/admin/businesses/${businessId}/staff`,
      );
      setStaff(data);
    } catch {
      setStaff([]);
    }
  }, [businessId, staff]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (tab === 'people') fetchStaff();
  }, [tab, fetchStaff]);

  if (loading) {
    return (
      <div className="p-6 md:p-8" data-testid="loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mx-auto mt-20" />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="p-6 md:p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-2xl">
          {error || 'Business not found'}
        </div>
      </div>
    );
  }

  const healthInfo = HEALTH_LABELS[business.health] || HEALTH_LABELS.red;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-slate-500 mb-4">
        <Link href="/console/businesses" className="hover:text-sage-600 transition-colors">
          Businesses
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 dark:text-white font-medium">{business.name}</span>
      </nav>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={() => setTab('summary')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            tab === 'summary'
              ? 'border-sage-600 text-sage-700 dark:text-sage-400'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
          data-testid="tab-summary"
        >
          Summary
        </button>
        <button
          onClick={() => setTab('people')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            tab === 'people'
              ? 'border-sage-600 text-sage-700 dark:text-sage-400'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
          data-testid="tab-people"
        >
          People
        </button>
      </div>

      {tab === 'summary' && (
        <div className="space-y-6">
          {/* Business Metadata */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Business Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-400">Name</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {business.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Slug</p>
                <p className="text-sm font-mono text-slate-600 dark:text-slate-300">
                  {business.slug}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Timezone</p>
                <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Globe size={14} />
                  {business.timezone}
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400">Vertical Pack</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 capitalize">
                  {business.verticalPack}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Plan</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 capitalize">
                  {business.subscription?.plan || 'Trial'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Created</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {new Date(business.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Usage Snapshot */}
          {usage && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Usage Snapshot
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sage-50 dark:bg-sage-900/20 rounded-xl">
                    <Calendar size={18} className="text-sage-600" />
                  </div>
                  <div>
                    <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                      {usage.bookings7d}
                    </p>
                    <p className="text-xs text-slate-500">Bookings (7d)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sage-50 dark:bg-sage-900/20 rounded-xl">
                    <Calendar size={18} className="text-sage-600" />
                  </div>
                  <div>
                    <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                      {usage.bookings30d}
                    </p>
                    <p className="text-xs text-slate-500">Bookings (30d)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
                    <MessageSquare size={18} className="text-lavender-600" />
                  </div>
                  <div>
                    <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                      {usage.conversations}
                    </p>
                    <p className="text-xs text-slate-500">Conversations</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <ClipboardList size={18} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                      {usage.waitlistEntries}
                    </p>
                    <p className="text-xs text-slate-500">Waitlist Active</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <Megaphone size={18} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                      {usage.campaigns}
                    </p>
                    <p className="text-xs text-slate-500">Campaigns Sent</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
                    <Bot size={18} className="text-lavender-600" />
                  </div>
                  <div>
                    <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                      {usage.agentRuns}
                    </p>
                    <p className="text-xs text-slate-500">Agent Runs (7d)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Health Status + Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Health Status
              </h2>
              <div
                className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-xl', healthInfo.bg)}
              >
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    business.health === 'green' && 'bg-emerald-400',
                    business.health === 'yellow' && 'bg-amber-400',
                    business.health === 'red' && 'bg-red-400',
                  )}
                />
                <span className={cn('text-sm font-medium', healthInfo.color)}>
                  {healthInfo.label}
                </span>
              </div>
              {business.lastActive && (
                <p className="text-xs text-slate-500 mt-3">
                  Last active: {new Date(business.lastActive).toLocaleDateString()}
                </p>
              )}
              {business.subscription && (
                <p className="text-xs text-slate-500 mt-1">
                  Billing: {business.subscription.status} — Period ends{' '}
                  {new Date(business.subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Quick Actions
              </h2>
              <div className="space-y-2">
                <button
                  onClick={() => router.push(`/console/businesses/${businessId}/view-as`)}
                  className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                  data-testid="view-as-button"
                >
                  <Eye size={16} />
                  View as this business
                </button>
                <Link
                  href="/console/support"
                  className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Open support case
                </Link>
              </div>
            </div>
          </div>

          {/* Counts Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Totals
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                  {business.counts.staff}
                </p>
                <p className="text-xs text-slate-500">Staff</p>
              </div>
              <div>
                <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                  {business.counts.customers}
                </p>
                <p className="text-xs text-slate-500">Customers</p>
              </div>
              <div>
                <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                  {business.counts.services}
                </p>
                <p className="text-xs text-slate-500">Services</p>
              </div>
              <div>
                <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
                  {business.counts.bookings}
                </p>
                <p className="text-xs text-slate-500">Total Bookings</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'people' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden">
          {!staff ? (
            <div className="p-12 text-center" data-testid="staff-loading">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mx-auto" />
            </div>
          ) : staff.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-sm text-slate-500">No staff members found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-slate-50 dark:border-slate-800/50"
                  >
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                      {member.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 hidden md:table-cell">
                      {member.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 text-xs rounded-lg font-medium',
                          ROLE_STYLES[member.role] || 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 text-xs rounded-lg font-medium',
                          member.isActive
                            ? 'bg-sage-50 text-sage-700'
                            : 'bg-red-50 text-red-700',
                        )}
                      >
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
