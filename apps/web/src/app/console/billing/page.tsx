'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  TrendingUp,
  AlertTriangle,
  Users,
  DollarSign,
  ArrowRight,
  CreditCard,
  Percent,
} from 'lucide-react';

interface DashboardData {
  mrr: number;
  activeCount: number;
  trialCount: number;
  pastDueCount: number;
  canceledCount: number;
  churnRate: number;
  arpa: number;
  trialToPaidRate: number;
  planDistribution: { basic: number; pro: number };
  totalRevenue30d: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ConsoleBillingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.get<DashboardData>('/admin/billing/dashboard');
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl" data-testid="billing-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-32" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-6xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
          Billing
        </h1>
        <div
          className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 text-red-700 dark:text-red-400"
          data-testid="billing-error"
        >
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Billing</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6" data-testid="kpi-cards">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-sage-600" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">MRR</span>
          </div>
          <p
            className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
            data-testid="mrr-value"
          >
            {formatCurrency(data.mrr)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-sage-600" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">Active</span>
          </div>
          <p
            className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
            data-testid="active-count"
          >
            {data.activeCount}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
          <div className="flex items-center gap-2 mb-2">
            <Percent
              size={14}
              className={data.churnRate > 0.05 ? 'text-red-500' : 'text-sage-600'}
            />
            <span className="text-xs text-slate-400 uppercase tracking-wider">Churn</span>
          </div>
          <p
            className={`text-2xl font-serif font-bold ${data.churnRate > 0.05 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}
            data-testid="churn-rate"
          >
            {formatPercent(data.churnRate)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-sage-600" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">ARPA</span>
          </div>
          <p
            className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
            data-testid="arpa-value"
          >
            {formatCurrency(data.arpa)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-sage-600" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">Trial → Paid</span>
          </div>
          <p
            className="text-2xl font-serif font-bold text-slate-900 dark:text-white"
            data-testid="trial-to-paid"
          >
            {formatPercent(data.trialToPaidRate)}
          </p>
        </div>
      </div>

      {/* Quick Links + Plan Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link
          href="/console/billing/past-due"
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 hover:shadow-md transition-shadow group"
          data-testid="past-due-link"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Past-Due Accounts
                </p>
                <p className="text-xs text-slate-400">Requires attention</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.pastDueCount > 0 && (
                <span
                  className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium px-2 py-1 rounded-full"
                  data-testid="past-due-badge"
                >
                  {data.pastDueCount}
                </span>
              )}
              <ArrowRight
                size={14}
                className="text-slate-400 group-hover:text-slate-600 transition-colors"
              />
            </div>
          </div>
        </Link>

        <Link
          href="/console/billing/subscriptions"
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 hover:shadow-md transition-shadow group"
          data-testid="subscriptions-link"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sage-50 dark:bg-sage-900/20 rounded-xl">
                <CreditCard size={18} className="text-sage-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  All Subscriptions
                </p>
                <p className="text-xs text-slate-400">Manage plans</p>
              </div>
            </div>
            <ArrowRight
              size={14}
              className="text-slate-400 group-hover:text-slate-600 transition-colors"
            />
          </div>
        </Link>

        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5"
          data-testid="plan-distribution"
        >
          <p className="text-sm font-medium text-slate-900 dark:text-white mb-3">
            Plan Distribution
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Basic ($49/mo)</span>
              <span
                className="text-sm font-medium text-slate-900 dark:text-white"
                data-testid="basic-count"
              >
                {data.planDistribution.basic}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
              <div
                className="bg-sage-500 h-2 rounded-full transition-all"
                style={{
                  width: `${data.activeCount > 0 ? (data.planDistribution.basic / data.activeCount) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Pro ($149/mo)</span>
              <span
                className="text-sm font-medium text-slate-900 dark:text-white"
                data-testid="pro-count"
              >
                {data.planDistribution.pro}
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
              <div
                className="bg-lavender-500 h-2 rounded-full transition-all"
                style={{
                  width: `${data.activeCount > 0 ? (data.planDistribution.pro / data.activeCount) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Past-Due Alert */}
      {data.pastDueCount > 0 && (
        <div
          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4"
          data-testid="past-due-alert"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="text-amber-600" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {data.pastDueCount} account{data.pastDueCount !== 1 ? 's' : ''} past due
              </p>
            </div>
            <Link
              href="/console/billing/past-due"
              className="text-sm text-amber-700 hover:text-amber-800 dark:text-amber-400 font-medium"
            >
              View all →
            </Link>
          </div>
        </div>
      )}

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
          <span className="text-xs text-slate-400">Trialing</span>
          <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            {data.trialCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
          <span className="text-xs text-slate-400">Canceled</span>
          <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            {data.canceledCount}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
          <span className="text-xs text-slate-400">30d Revenue</span>
          <p className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            {formatCurrency(data.totalRevenue30d)}
          </p>
        </div>
      </div>
    </div>
  );
}
