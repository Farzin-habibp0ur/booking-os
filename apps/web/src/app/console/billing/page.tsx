'use client';

import { CreditCard, TrendingUp, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ConsoleBillingPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Billing</h1>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
            <CreditCard className="text-lavender-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Billing & Revenue Operations</h2>
            <p className="text-sm text-lavender-600">Phase 3 — Planned</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Full billing dashboard for monitoring and managing tenant subscriptions, revenue metrics, and payment health.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <TrendingUp size={16} className="text-sage-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Revenue Metrics</p>
              <p className="text-xs text-slate-500">MRR, churn rate, ARPA, trial-to-paid conversion</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Past-Due Management</p>
              <p className="text-xs text-slate-500">Aging reports, dunning status, recovery tracking</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <CreditCard size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Tenant Controls</p>
              <p className="text-xs text-slate-500">Plan changes, credits, cancellations with reason codes</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Clock size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Invoice History</p>
              <p className="text-xs text-slate-500">Per-tenant payment history and invoice access</p>
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/console/businesses"
        className="inline-flex items-center gap-2 text-sm text-sage-600 hover:text-sage-700"
      >
        View per-business billing in Business 360 <ArrowRight size={14} />
      </Link>
    </div>
  );
}
