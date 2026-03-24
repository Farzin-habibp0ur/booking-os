'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ArrowLeft, Zap, Send, Ban, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function AutomationAnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [byRule, setByRule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      api.get<any>('/automations/analytics/overview'),
      api.get<any>('/automations/analytics/timeline?days=30'),
      api.get<any>('/automations/analytics/by-rule'),
    ])
      .then(([o, t, r]) => {
        setOverview(o);
        setTimeline(Array.isArray(t) ? t : []);
        setByRule(Array.isArray(r) ? r : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  const pieData = [
    { name: 'Sent', value: overview?.totalMessagesSent7d || 0, color: '#71907C' },
    { name: 'Skipped', value: overview?.totalMessagesSkipped7d || 0, color: '#d97706' },
    { name: 'Failed', value: overview?.totalMessagesFailed7d || 0, color: '#dc2626' },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push('/automations')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={16} /> Back to Automations
      </button>

      <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-6">
        Automation Analytics
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Active Rules',
            value: overview?.totalRulesActive || 0,
            icon: Zap,
            color: 'text-sage-600',
          },
          {
            label: 'Messages Sent (7d)',
            value: overview?.totalMessagesSent7d || 0,
            icon: Send,
            color: 'text-sage-600',
          },
          {
            label: 'Delivery Rate',
            value: `${overview?.deliveryRate || 0}%`,
            icon: TrendingUp,
            color: 'text-sage-600',
          },
          {
            label: 'Skipped (7d)',
            value: overview?.totalMessagesSkipped7d || 0,
            icon: Ban,
            color: 'text-amber-600',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={14} className={stat.color} />
              <span className="text-xs text-slate-500">{stat.label}</span>
            </div>
            <p className="text-2xl font-serif font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Timeline chart */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Daily Volume (30 days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="sent"
                stackId="1"
                stroke="#71907C"
                fill="#71907C"
                fillOpacity={0.6}
                name="Sent"
              />
              <Area
                type="monotone"
                dataKey="skipped"
                stackId="1"
                stroke="#d97706"
                fill="#d97706"
                fillOpacity={0.4}
                name="Skipped"
              />
              <Area
                type="monotone"
                dataKey="failed"
                stackId="1"
                stroke="#dc2626"
                fill="#dc2626"
                fillOpacity={0.4}
                name="Failed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        {/* Skip reasons pie chart */}
        {pieData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Outcome Breakdown (7d)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top performing rule */}
        {overview?.topPerformingRule && (
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Top Performing Rule</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sage-50 rounded-xl flex items-center justify-center">
                <Zap size={18} className="text-sage-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{overview.topPerformingRule.name}</p>
                <p className="text-xs text-slate-500">
                  {overview.topPerformingRule.sentCount} messages sent this week
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Per-rule table */}
      {byRule.length > 0 && (
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Per-Rule Breakdown (7d)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 font-medium">Rule</th>
                  <th className="text-left py-2 font-medium">Trigger</th>
                  <th className="text-right py-2 font-medium">Sent</th>
                  <th className="text-right py-2 font-medium">Skipped</th>
                  <th className="text-right py-2 font-medium">Failed</th>
                  <th className="text-right py-2 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {byRule
                  .sort((a, b) => b.sent - a.sent)
                  .map((r: any) => {
                    const total = r.sent + r.failed;
                    const rate = total > 0 ? Math.round((r.sent / total) * 100) : 0;
                    return (
                      <tr key={r.ruleId} className="border-b border-slate-50">
                        <td className="py-2 font-medium text-slate-900">{r.ruleName}</td>
                        <td className="py-2 text-slate-500">
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">
                            {r.trigger}
                          </span>
                        </td>
                        <td className="py-2 text-right text-sage-700">{r.sent}</td>
                        <td className="py-2 text-right text-amber-600">{r.skipped}</td>
                        <td className="py-2 text-right text-red-600">{r.failed}</td>
                        <td className="py-2 text-right">
                          <span
                            className={cn(
                              'text-xs font-medium',
                              rate >= 90
                                ? 'text-sage-700'
                                : rate >= 70
                                  ? 'text-amber-600'
                                  : 'text-red-600',
                            )}
                          >
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
