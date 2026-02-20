'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Building2,
  Users,
  Calendar,
  MessageSquare,
  Bot,
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface AttentionItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  timestamp: string;
}

interface AtRiskAccount {
  businessId: string;
  businessName: string;
  riskScore: number;
  plan: string | null;
  status: string | null;
  lastBooking: string | null;
  topSignal: string;
}

interface OverviewData {
  businesses: {
    total: number;
    withActiveSubscription: number;
    trial: number;
    pastDue: number;
    canceled: number;
  };
  bookings: {
    total: number;
    today: number;
    last7d: number;
    last30d: number;
  };
  platform: {
    totalStaff: number;
    totalCustomers: number;
    totalConversations: number;
    totalAgentRuns: number;
    agentRuns7d: number;
    failedAgentRuns7d: number;
  };
  support: {
    openCases: number;
  };
  security: {
    activeViewAsSessions: number;
  };
  recentAuditLogs: Array<{
    id: string;
    actorEmail: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
  }>;
  attentionItems: AttentionItem[];
  accountsAtRisk: AtRiskAccount[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  href?: string;
}) {
  const content = (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <Icon className="text-slate-400 dark:text-slate-500" size={20} />
      </div>
      <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertTriangle,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: AlertCircle,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Info,
  },
};

function RiskBar({ score }: { score: number }) {
  const color = score > 70 ? 'bg-red-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-slate-100 dark:bg-slate-800 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${Math.min(score, 100)}%` }}
          data-testid="risk-bar"
        />
      </div>
      <span className={`text-xs font-medium ${score > 70 ? 'text-red-600' : 'text-amber-600'}`} data-testid="risk-score">
        {score}
      </span>
    </div>
  );
}

export default function ConsoleOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<OverviewData>('/admin/overview').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Overview</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 md:p-8 max-w-7xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Overview</h1>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center">
          <p className="text-slate-500">Failed to load overview data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Platform Overview</h1>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Businesses" value={data.businesses.total} icon={Building2} href="/console/businesses" />
        <StatCard label="Active Subscriptions" value={data.businesses.withActiveSubscription} icon={Activity} />
        <StatCard label="Bookings Today" value={data.bookings.today} icon={Calendar} />
        <StatCard label="Total Customers" value={data.platform.totalCustomers} icon={Users} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Bookings (7d)" value={data.bookings.last7d} icon={Calendar} />
        <StatCard label="Bookings (30d)" value={data.bookings.last30d} icon={Calendar} />
        <StatCard label="Total Conversations" value={data.platform.totalConversations} icon={MessageSquare} />
        <StatCard label="Agent Runs (7d)" value={data.platform.agentRuns7d} icon={Bot} />
      </div>

      {/* Attention Feed */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 mb-6" data-testid="attention-feed">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Attention Feed</h3>
        {data.attentionItems.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4" data-testid="attention-empty">All clear</p>
        ) : (
          <div className="space-y-3">
            {data.attentionItems.map((item) => {
              const config = SEVERITY_CONFIG[item.severity];
              const SeverityIcon = config.icon;
              return (
                <div
                  key={item.id}
                  className={`${config.bg} border ${config.border} rounded-xl p-4`}
                  data-testid={`attention-item-${item.severity}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <SeverityIcon size={16} className="mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badge}`} data-testid="severity-badge">
                            {item.severity}
                          </span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{item.description}</p>
                      </div>
                    </div>
                    <Link
                      href={item.actionHref}
                      className="shrink-0 flex items-center gap-1 text-xs font-medium text-sage-600 hover:text-sage-700 whitespace-nowrap"
                      data-testid="attention-action"
                    >
                      {item.actionLabel}
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Accounts at Risk */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 mb-6" data-testid="at-risk-section">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Accounts at Risk</h3>
        {data.accountsAtRisk.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4" data-testid="at-risk-empty">No accounts at risk</p>
        ) : (
          <div className="overflow-x-auto" data-testid="at-risk-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2 pr-4">Business</th>
                  <th className="pb-2 pr-4">Risk Score</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Last Booking</th>
                  <th className="pb-2">Top Signal</th>
                </tr>
              </thead>
              <tbody>
                {data.accountsAtRisk.map((account) => (
                  <tr key={account.businessId} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/console/businesses/${account.businessId}`}
                        className="text-sage-600 hover:text-sage-700 font-medium"
                        data-testid="business-link"
                      >
                        {account.businessName}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <RiskBar score={account.riskScore} />
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{account.plan || '—'}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={account.status} />
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {account.lastBooking ? timeAgo(account.lastBooking) : 'Never'}
                    </td>
                    <td className="py-3 text-slate-500">{account.topSignal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent Activity</h3>
          <Link href="/console/audit" className="text-sm text-sage-600 hover:text-sage-700">
            View all
          </Link>
        </div>
        {data.recentAuditLogs.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {data.recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-slate-500 truncate max-w-[160px]">{log.actorEmail}</span>
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {formatAction(log.action)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{timeAgo(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-400">—</span>;

  const styles: Record<string, string> = {
    active: 'bg-sage-50 text-sage-900',
    trialing: 'bg-lavender-50 text-lavender-900',
    past_due: 'bg-amber-50 text-amber-700',
    canceled: 'bg-red-50 text-red-700',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
