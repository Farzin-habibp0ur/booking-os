'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { usePack, VerticalPackProvider } from '@/lib/vertical-pack';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { ToastProvider } from '@/lib/toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { LanguagePicker } from '@/components/language-picker';
import { cn } from '@/lib/cn';
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Users,
  BookOpen,
  Scissors,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <VerticalPackProvider>
      <I18nProvider>
        <ToastProvider>
          <ShellInner>{children}</ShellInner>
        </ToastProvider>
      </I18nProvider>
    </VerticalPackProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const pack = usePack();
  const { t } = useI18n();

  const nav = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/inbox', label: t('nav.inbox'), icon: MessageSquare },
    { href: '/calendar', label: t('nav.calendar'), icon: Calendar },
    {
      href: '/customers',
      label: t('nav.customers', { entity: pack.labels.customer }),
      icon: Users,
    },
    {
      href: '/bookings',
      label: t('nav.bookings', { entity: pack.labels.booking }),
      icon: BookOpen,
    },
    {
      href: '/services',
      label: t('nav.services', { entity: pack.labels.service }),
      icon: Scissors,
    },
    { href: '/staff', label: t('nav.staff'), icon: UserCog },
    { href: '/reports', label: t('nav.reports'), icon: BarChart3 },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-white border-r border-slate-100 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-lg font-serif font-bold text-slate-900">{t('app.title')}</h1>
          <p className="text-xs text-slate-500 truncate">{user?.business?.name}</p>
          {pack.name !== 'general' && (
            <p className="text-[10px] text-sage-500 mt-0.5 capitalize">{pack.name} Pack</p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
                pathname.startsWith(href)
                  ? 'bg-sage-50 text-sage-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-100 space-y-1">
          <div className="px-3 py-1">
            <LanguagePicker />
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-50 w-full transition-colors"
          >
            <LogOut size={18} />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
