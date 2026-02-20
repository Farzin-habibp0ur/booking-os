'use client';

import { MessageSquare, AlertCircle, Webhook, CheckCircle } from 'lucide-react';

export default function ConsoleMessagingPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Messaging Ops</h1>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
            <MessageSquare className="text-lavender-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Messaging Operations</h2>
            <p className="text-sm text-lavender-600">Phase 5 — Planned</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Monitor message delivery across all tenants, track webhook health, and manage WhatsApp connection status.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Delivery Failures</p>
              <p className="text-xs text-slate-500">Failed messages, top error reasons, impacted tenants</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Webhook size={16} className="text-sage-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Webhook Health</p>
              <p className="text-xs text-slate-500">Webhook success rates, latency, retry queue depth</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <CheckCircle size={16} className="text-sage-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Connection Status</p>
              <p className="text-xs text-slate-500">Per-tenant WhatsApp connection health + fix checklists</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <MessageSquare size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Top Impacted Tenants</p>
              <p className="text-xs text-slate-500">Rank tenants by delivery failure rate for targeted fixes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
