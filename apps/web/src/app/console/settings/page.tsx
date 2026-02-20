'use client';

import { Settings, Shield, Bell, Globe } from 'lucide-react';

export default function ConsoleSettingsPage() {
  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">Settings</h1>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
            <Settings className="text-lavender-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Platform Settings</h2>
            <p className="text-sm text-lavender-600">Phase 6 — Planned</p>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Configure platform-wide defaults, security policies, and global settings for all tenants.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Shield size={16} className="text-sage-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Security Posture</p>
              <p className="text-xs text-slate-500">Default cookie settings, session timeouts, 2FA policy</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Bell size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Notification Defaults</p>
              <p className="text-xs text-slate-500">Default reminder timing, quiet hours, escalation rules</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Globe size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Regional Defaults</p>
              <p className="text-xs text-slate-500">Default timezone, locale, currency for new tenants</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <Settings size={16} className="text-slate-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Platform Configuration</p>
              <p className="text-xs text-slate-500">Feature flags, API rate limits, maintenance mode</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
