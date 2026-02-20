'use client';

import { Package, Layers, GitBranch, ToggleLeft } from 'lucide-react';

export default function ConsolePacksPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Packs & Skills</h1>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
            <Package className="text-lavender-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pack & Skill Release Management</h2>
            <p className="text-sm text-lavender-600">Phase 4 — Planned</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Manage vertical packs across all tenants — version control, staged rollouts, and skill catalog governance.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Layers size={16} className="text-sage-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Pack Registry</p>
              <p className="text-xs text-slate-500">Browse by vertical, version history, adoption rates</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <GitBranch size={16} className="text-sage-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Rollout Controls</p>
              <p className="text-xs text-slate-500">Staged rollouts (5% → 25% → 100%), pause, rollback</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <ToggleLeft size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Skills Catalog</p>
              <p className="text-xs text-slate-500">Enable/disable per pack, safety tiers, adoption metrics</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Package size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Release Workflow</p>
              <p className="text-xs text-slate-500">Draft → Validate → Publish → Monitor → Rollback</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
