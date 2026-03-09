'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider } from '@/lib/auth';
import { Shell } from '@/components/shell';
import { Sparkles, Bot, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/ai', label: 'Overview', icon: Sparkles },
  { href: '/ai/agents', label: 'Agents', icon: Bot },
  { href: '/ai/actions', label: 'Actions', icon: Zap },
  { href: '/ai/performance', label: 'Performance', icon: TrendingUp },
];

export default function AILayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthProvider>
      <Shell>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles size={32} className="text-lavender-500" />
                <h1 className="font-serif text-3xl font-bold text-slate-900 dark:text-white">
                  AI Command Center
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Monitor and manage your AI agents and automations
              </p>
            </div>

            {/* Tab Bar */}
            <div className="border-b border-slate-200 dark:border-slate-800 mb-8" data-testid="ai-tab-bar">
              <div className="flex gap-6 px-0">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = pathname === tab.href;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={cn(
                        'flex items-center gap-2 px-1 py-3 text-sm font-medium transition-all whitespace-nowrap border-b-2 -mb-px',
                        isActive
                          ? 'border-sage-600 text-sage-700 dark:text-sage-400 dark:border-sage-400'
                          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                      )}
                      data-testid={`ai-tab-${tab.label.toLowerCase()}`}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Tab Content */}
            {children}
          </div>
        </div>
      </Shell>
    </AuthProvider>
  );
}
