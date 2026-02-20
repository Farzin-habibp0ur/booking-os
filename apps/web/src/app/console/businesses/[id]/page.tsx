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
  CreditCard,
  X,
  AlertTriangle,
  DollarSign,
  FileText,
  RefreshCw,
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

interface BillingData {
  subscription: {
    id: string;
    plan: string;
    status: string;
    currentPeriodEnd: string;
    stripeSubscriptionId: string;
    canceledAt: string | null;
    cancelReason: string | null;
    planChangedAt: string | null;
  } | null;
  credits: BillingCreditItem[];
  recentInvoices: InvoiceItem[];
}

interface BillingCreditItem {
  id: string;
  amount: number;
  reason: string;
  expiresAt: string | null;
  appliedAt: string | null;
  stripeId: string | null;
  createdAt: string;
  issuedBy: { name: string; email: string };
}

interface InvoiceItem {
  id: string;
  amount: number;
  status: string;
  date: string | null;
  pdfUrl: string | null;
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

const PLAN_PRICES: Record<string, number> = { basic: 49, pro: 149 };

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-sage-50 text-sage-900',
  trialing: 'bg-lavender-50 text-lavender-900',
  past_due: 'bg-amber-50 text-amber-700',
  canceled: 'bg-red-50 text-red-700',
};

const INVOICE_STATUS: Record<string, string> = {
  paid: 'bg-sage-50 text-sage-900',
  open: 'bg-amber-50 text-amber-700',
  void: 'bg-slate-100 text-slate-600',
  draft: 'bg-slate-100 text-slate-600',
};

export default function Business360Page() {
  const params = useParams();
  const router = useRouter();
  const businessId = params.id as string;

  const [tab, setTab] = useState<'summary' | 'people' | 'billing'>('summary');
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [credits, setCredits] = useState<BillingCreditItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState('');

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
    if (staff) return;
    try {
      const data = await api.get<StaffMember[]>(
        `/admin/businesses/${businessId}/staff`,
      );
      setStaff(data);
    } catch {
      setStaff([]);
    }
  }, [businessId, staff]);

  const fetchBilling = useCallback(async () => {
    if (billingData) return;
    try {
      setBillingLoading(true);
      const [billing, creditList, invoiceList] = await Promise.all([
        api.get<BillingData>(`/admin/businesses/${businessId}/billing`),
        api.get<BillingCreditItem[]>(`/admin/businesses/${businessId}/billing/credits`),
        api.get<InvoiceItem[]>(`/admin/businesses/${businessId}/billing/invoices`),
      ]);
      setBillingData(billing);
      setCredits(creditList);
      setInvoices(invoiceList);
    } catch {
      setBillingData({ subscription: null, credits: [], recentInvoices: [] });
    } finally {
      setBillingLoading(false);
    }
  }, [businessId, billingData]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (tab === 'people') fetchStaff();
    if (tab === 'billing') fetchBilling();
  }, [tab, fetchStaff, fetchBilling]);

  const refreshBilling = async () => {
    setBillingData(null);
    setBillingLoading(true);
    try {
      const [billing, creditList, invoiceList] = await Promise.all([
        api.get<BillingData>(`/admin/businesses/${businessId}/billing`),
        api.get<BillingCreditItem[]>(`/admin/businesses/${businessId}/billing/credits`),
        api.get<InvoiceItem[]>(`/admin/businesses/${businessId}/billing/invoices`),
      ]);
      setBillingData(billing);
      setCredits(creditList);
      setInvoices(invoiceList);
    } catch {
      setBillingData({ subscription: null, credits: [], recentInvoices: [] });
    } finally {
      setBillingLoading(false);
    }
  };

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
  const sub = billingData?.subscription;
  const isCanceled = sub?.status === 'canceled' || !!sub?.canceledAt;

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
        <button
          onClick={() => setTab('billing')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            tab === 'billing'
              ? 'border-sage-600 text-sage-700 dark:text-sage-400'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
          data-testid="tab-billing"
        >
          Billing
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

      {tab === 'billing' && (
        <div className="space-y-6" data-testid="billing-tab">
          {billingLoading ? (
            <div className="p-12 text-center" data-testid="billing-loading">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mx-auto" />
            </div>
          ) : !sub ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center" data-testid="no-subscription">
              <CreditCard size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-slate-900 dark:text-white">No subscription</p>
              <p className="text-sm text-slate-400 mt-1">This business has no active subscription.</p>
            </div>
          ) : (
            <>
              {/* Subscription Info */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="subscription-info">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Subscription
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Plan</p>
                    <span className={`inline-block mt-1 text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_BADGE[sub.plan] || 'bg-slate-100 text-slate-700'}`}>
                      {sub.plan}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <span className={`inline-block mt-1 text-xs font-medium px-2 py-1 rounded-full ${STATUS_BADGE[sub.status] || ''}`}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Period End</p>
                    <p className="text-sm text-slate-900 dark:text-white mt-1">
                      {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Stripe ID</p>
                    <p className="text-xs font-mono text-slate-500 mt-1 truncate" title={sub.stripeSubscriptionId}>
                      {sub.stripeSubscriptionId}
                    </p>
                  </div>
                </div>
                {sub.canceledAt && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-700 dark:text-red-400">
                    Canceled on {new Date(sub.canceledAt).toLocaleDateString()}
                    {sub.cancelReason && ` — ${sub.cancelReason}`}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="billing-actions">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Actions
                </h2>
                <div className="flex flex-wrap gap-3">
                  {!isCanceled && (
                    <button
                      onClick={() => setShowChangePlan(true)}
                      className="px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors"
                      data-testid="change-plan-btn"
                    >
                      Change Plan
                    </button>
                  )}
                  <button
                    onClick={() => setShowCredit(true)}
                    className="px-4 py-2 text-sm font-medium rounded-xl bg-lavender-600 text-white hover:bg-lavender-700 transition-colors"
                    data-testid="issue-credit-btn"
                  >
                    Issue Credit
                  </button>
                  {!isCanceled ? (
                    <button
                      onClick={() => setShowCancel(true)}
                      className="px-4 py-2 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
                      data-testid="cancel-btn"
                    >
                      Cancel Subscription
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowReactivate(true)}
                      className="px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors"
                      data-testid="reactivate-btn"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>

              {/* Credits History */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="credits-table">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Credits
                </h2>
                {credits.length === 0 ? (
                  <p className="text-sm text-slate-400">No credits issued</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2">Amount</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2">Reason</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2 hidden md:table-cell">Issued By</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2 hidden md:table-cell">Date</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {credits.map((c) => (
                        <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800/50">
                          <td className="px-2 py-2 font-medium text-slate-900 dark:text-white">${c.amount}</td>
                          <td className="px-2 py-2 text-slate-600 dark:text-slate-400 truncate max-w-[200px]">{c.reason}</td>
                          <td className="px-2 py-2 text-slate-500 hidden md:table-cell">{c.issuedBy.name}</td>
                          <td className="px-2 py-2 text-slate-500 hidden md:table-cell">{new Date(c.createdAt).toLocaleDateString()}</td>
                          <td className="px-2 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${c.appliedAt ? 'bg-sage-50 text-sage-900' : 'bg-amber-50 text-amber-700'}`}>
                              {c.appliedAt ? 'Applied' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Invoice History */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6" data-testid="invoices-table">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                  Invoices
                </h2>
                {invoices.length === 0 ? (
                  <p className="text-sm text-slate-400">No invoices found</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2">Date</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2">Amount</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2">Status</th>
                        <th className="text-left text-xs font-medium text-slate-400 uppercase px-2 py-2">PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-slate-50 dark:border-slate-800/50">
                          <td className="px-2 py-2 text-slate-600 dark:text-slate-400">
                            {inv.date ? new Date(inv.date).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-2 py-2 font-medium text-slate-900 dark:text-white">${inv.amount}</td>
                          <td className="px-2 py-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${INVOICE_STATUS[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {inv.pdfUrl ? (
                              <a href={inv.pdfUrl} target="_blank" rel="noreferrer" className="text-sage-600 hover:text-sage-700 text-xs font-medium">
                                Download
                              </a>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Change Plan Modal */}
      {showChangePlan && sub && (
        <ChangePlanModal
          currentPlan={sub.plan}
          businessName={business.name}
          businessId={businessId}
          onClose={() => { setShowChangePlan(false); setMutationError(''); }}
          onSuccess={() => { setShowChangePlan(false); refreshBilling(); fetchSummary(); }}
        />
      )}

      {/* Issue Credit Modal */}
      {showCredit && (
        <IssueCreditModal
          businessId={businessId}
          businessName={business.name}
          onClose={() => { setShowCredit(false); setMutationError(''); }}
          onSuccess={() => { setShowCredit(false); refreshBilling(); }}
        />
      )}

      {/* Cancel Modal */}
      {showCancel && (
        <CancelModal
          businessId={businessId}
          businessName={business.name}
          periodEnd={sub?.currentPeriodEnd || ''}
          onClose={() => { setShowCancel(false); setMutationError(''); }}
          onSuccess={() => { setShowCancel(false); refreshBilling(); fetchSummary(); }}
        />
      )}

      {/* Reactivate Modal */}
      {showReactivate && (
        <ReactivateModal
          businessId={businessId}
          businessName={business.name}
          onClose={() => { setShowReactivate(false); }}
          onSuccess={() => { setShowReactivate(false); refreshBilling(); fetchSummary(); }}
        />
      )}
    </div>
  );
}

// ─── Modals ──────────────────────────────────────────────

function ChangePlanModal({ currentPlan, businessName, businessId, onClose, onSuccess }: {
  currentPlan: string;
  businessName: string;
  businessId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newPlan, setNewPlan] = useState(currentPlan === 'basic' ? 'pro' : 'basic');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/businesses/${businessId}/billing/change-plan`, { newPlan, reason });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to change plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="change-plan-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Change Plan</h2>
          <button onClick={onClose} data-testid="modal-close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 block mb-2">New Plan</label>
            <div className="space-y-2">
              {['basic', 'pro'].map((plan) => (
                <label key={plan} className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border cursor-pointer',
                  plan === newPlan ? 'border-sage-500 bg-sage-50 dark:bg-sage-900/20' : 'border-slate-200 dark:border-slate-700',
                  plan === currentPlan && 'opacity-50 cursor-not-allowed',
                )}>
                  <input
                    type="radio"
                    name="plan"
                    value={plan}
                    checked={newPlan === plan}
                    disabled={plan === currentPlan}
                    onChange={() => setNewPlan(plan)}
                    className="text-sage-600"
                  />
                  <span className="text-sm font-medium capitalize">{plan}</span>
                  <span className="text-sm text-slate-500 ml-auto">${PLAN_PRICES[plan]}/mo</span>
                </label>
              ))}
            </div>
          </div>
          <p className="text-sm text-slate-500 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            Plan will change from <strong className="capitalize">{currentPlan}</strong> (${PLAN_PRICES[currentPlan]}/mo) to{' '}
            <strong className="capitalize">{newPlan}</strong> (${PLAN_PRICES[newPlan]}/mo). Prorated charges will apply.
          </p>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 block mb-1">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:ring-2 focus:ring-sage-500 outline-none"
              data-testid="reason-input"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50"
              data-testid="confirm-change-plan"
            >
              {submitting ? 'Changing...' : 'Change Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IssueCreditModal({ businessId, businessName, onClose, onSuccess }: {
  businessId: string;
  businessName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/businesses/${businessId}/billing/credit`, {
        amount: parseFloat(amount),
        reason,
        ...(expiresAt ? { expiresAt } : {}),
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to issue credit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="credit-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Issue Credit</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 block mb-1">Amount ($) *</label>
            <input
              type="number"
              min="1"
              max="10000"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:ring-2 focus:ring-sage-500 outline-none"
              data-testid="credit-amount"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 block mb-1">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:ring-2 focus:ring-sage-500 outline-none"
              data-testid="credit-reason"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 block mb-1">Expires (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:ring-2 focus:ring-sage-500 outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button
              type="submit"
              disabled={submitting || !amount || !reason.trim()}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-lavender-600 text-white hover:bg-lavender-700 disabled:opacity-50"
              data-testid="confirm-credit"
            >
              {submitting ? 'Issuing...' : 'Issue Credit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CancelModal({ businessId, businessName, periodEnd, onClose, onSuccess }: {
  businessId: string;
  businessName: string;
  periodEnd: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [immediate, setImmediate] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/businesses/${businessId}/billing/cancel`, { reason, immediate });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = reason.trim() && confirmation === businessName;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="cancel-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-red-700">Cancel Subscription</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              This will cancel <strong>{businessName}</strong>&apos;s subscription.
              {!immediate && periodEnd && (
                <> They will lose access at {new Date(periodEnd).toLocaleDateString()}.</>
              )}
              {immediate && <> Access will be revoked immediately.</>}
            </p>
          </div>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 block mb-1">Reason *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:ring-2 focus:ring-sage-500 outline-none"
              data-testid="cancel-reason"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="cancelType"
                checked={!immediate}
                onChange={() => setImmediate(false)}
              />
              Cancel at period end
            </label>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input
                type="radio"
                name="cancelType"
                checked={immediate}
                onChange={() => setImmediate(true)}
              />
              Cancel immediately
            </label>
          </div>
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 block mb-1">
              Type &quot;{businessName}&quot; to confirm
            </label>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm border-transparent focus:ring-2 focus:ring-sage-500 outline-none"
              data-testid="cancel-confirmation"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Go Back</button>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              data-testid="confirm-cancel"
            >
              {submitting ? 'Canceling...' : 'Cancel Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReactivateModal({ businessId, businessName, onClose, onSuccess }: {
  businessId: string;
  businessName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/businesses/${businessId}/billing/reactivate`);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to reactivate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="reactivate-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Reactivate Subscription</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Reactivate <strong>{businessName}</strong>&apos;s subscription? This will resume billing at the next period.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50"
            data-testid="confirm-reactivate"
          >
            {submitting ? 'Reactivating...' : 'Reactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
