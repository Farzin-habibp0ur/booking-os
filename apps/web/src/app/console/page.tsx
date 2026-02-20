'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Building2,
  Users,
  Calendar,
  MessageSquare,
  Bot,
  ShieldCheck,
  Activity,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

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

      {/* Attention Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Billing Attention */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Billing</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Trial</span>
              <span className="font-medium text-slate-900 dark:text-white">{data.businesses.trial}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-amber-600">Past Due</span>
              <span className="font-medium text-amber-600">{data.businesses.pastDue}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-600">Canceled</span>
              <span className="font-medium text-red-600">{data.businesses.canceled}</span>
            </div>
          </div>
        </div>

        {/* Support */}
        <Link href="/console/support" className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Support</h3>
          <p className="text-3xl font-serif font-bold text-slate-900 dark:text-white">{data.support.openCases}</p>
          <p className="text-sm text-slate-500 mt-1">Open cases</p>
        </Link>

        {/* Security */}
        <Link href="/console/audit" className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 hover:shadow-md transition-shadow">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Security</h3>
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-slate-400" />
            <span className="text-sm text-slate-500">
              {data.security.activeViewAsSessions} active view-as session{data.security.activeViewAsSessions !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <ShieldCheck size={16} className="text-sage-600" />
            <span className="text-sm text-slate-500">
              {data.platform.failedAgentRuns7d === 0
                ? 'No failed agent runs'
                : `${data.platform.failedAgentRuns7d} failed agent runs (7d)`}
            </span>
          </div>
        </Link>
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
