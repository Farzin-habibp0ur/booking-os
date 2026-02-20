'use client';

import { Bot, BarChart3, Pause, Sliders } from 'lucide-react';

export default function ConsoleAgentsPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">AI & Agents</h1>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
            <Bot className="text-lavender-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">AI & Agent Governance</h2>
            <p className="text-sm text-lavender-600">Phase 5 — Planned</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Monitor AI agent performance across all tenants, manage autonomy levels, and govern platform-wide agent behavior.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <BarChart3 size={16} className="text-sage-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Agent Performance</p>
              <p className="text-xs text-slate-500">Success rates, ActionCard funnel, top failure reasons</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Pause size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Tenant Controls</p>
              <p className="text-xs text-slate-500">Pause agents, disable skills, reduce autonomy per-tenant</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Sliders size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Platform Defaults</p>
              <p className="text-xs text-slate-500">FULL_AUTO vs reviewed, confidence thresholds</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Bot size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Abnormal Tenant Detection</p>
              <p className="text-xs text-slate-500">Flag tenants with unusual agent activity patterns</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
