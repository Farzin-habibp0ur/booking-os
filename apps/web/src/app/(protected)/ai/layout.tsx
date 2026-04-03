'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Bot, Zap, TrendingUp, ListFilter, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const TABS = [
  { href: '/ai', label: 'Overview', icon: Sparkles },
  { href: '/ai/agents', label: 'Agents', icon: Bot },
  { href: '/ai/actions', label: 'Actions', icon: ListFilter },
  { href: '/ai/automations', label: 'Automations', icon: Zap },
  { href: '/ai/performance', label: 'Performance', icon: TrendingUp },
];

export default function AILayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [actionCount, setActionCount] = useState<number>(0);

  useEffect(() => {
    api
      .get<{ count: number }>('/action-cards/count')
      .then((data) => setActionCount(data.count ?? 0))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Sparkles size={32} className="text-lavender-500" />
              <h1 className="font-serif text-3xl font-bold text-slate-900 dark:text-white">
                AI Hub
              </h1>
            </div>
            <Link
              href="/ai/settings"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              data-testid="ai-settings-link"
            >
              <Settings size={20} />
            </Link>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your AI agents, automations, and intelligence
          </p>
        </div>

        {/* Tab Bar */}
        <div
          className="border-b border-slate-200 dark:border-slate-800 mb-8"
          data-testid="ai-tab-bar"
        >
          <div className="flex gap-6 px-0 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'flex items-center gap-2 px-1 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px flex-shrink-0',
                    isActive
                      ? 'border-sage-600 text-sage-700 dark:text-sage-400 dark:border-sage-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                  data-testid={`ai-tab-${tab.label.toLowerCase()}`}
                >
                  <Icon size={16} />
                  {tab.label}
                  {tab.label === 'Actions' && actionCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {actionCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {children}
      </div>
    </div>
  );
}
