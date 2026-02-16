'use client';

import { ReactNode, useState, useEffect } from 'react';
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
  ClipboardList,
  Calendar,
  Users,
  BookOpen,
  Scissors,
  UserCog,
  BarChart3,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  Search,
  X,
} from 'lucide-react';
import CommandPalette from '@/components/command-palette';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdkOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const role = user?.role;

  const allNav = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'] },
    { href: '/inbox', label: t('nav.inbox'), icon: MessageSquare, roles: ['ADMIN', 'AGENT'] },
    { href: '/waitlist', label: 'Waitlist', icon: ClipboardList, roles: ['ADMIN', 'AGENT'] },
    { href: '/calendar', label: t('nav.calendar'), icon: Calendar, roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'] },
    {
      href: '/customers',
      label: t('nav.customers', { entity: pack.labels.customer }),
      icon: Users,
      roles: ['ADMIN', 'AGENT'],
    },
    {
      href: '/bookings',
      label: t('nav.bookings', { entity: pack.labels.booking }),
      icon: BookOpen,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    {
      href: '/services',
      label: t('nav.services', { entity: pack.labels.service }),
      icon: Scissors,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    { href: '/staff', label: t('nav.staff'), icon: UserCog, roles: ['ADMIN'] },
    { href: '/reports', label: t('nav.reports'), icon: BarChart3, roles: ['ADMIN', 'AGENT'] },
    ...(pack.name !== 'general'
      ? [{ href: '/roi', label: t('nav.roi'), icon: TrendingUp, roles: ['ADMIN'] }]
      : []),
    { href: '/settings', label: t('nav.settings'), icon: Settings, roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'] },
  ];

  const nav = allNav.filter((item) => !role || item.roles.includes(role));

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-serif font-bold text-slate-900">{t('app.title')}</h1>
          <p className="text-xs text-slate-500 truncate">{user?.business?.name}</p>
          {pack.name !== 'general' && (
            <p className="text-[10px] text-sage-500 mt-0.5 capitalize">{pack.name} Pack</p>
          )}
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>
      <button
        onClick={() => setCmdkOpen(true)}
        className="mx-2 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors w-[calc(100%-1rem)]"
      >
        <Search size={16} />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden sm:inline text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">⌘K</kbd>
      </button>
      <nav role="navigation" aria-label="Main navigation" className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? 'page' : undefined}
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
    </>
  );

  return (
    <div className="flex h-screen">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-sage-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl"
      >
        Skip to main content
      </a>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 md:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-slate-600 hover:text-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-sm font-serif font-bold text-slate-900 truncate">
          {user?.business?.name || t('app.title')}
        </h1>
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-slate-100 flex flex-col transform transition-transform duration-200',
          'md:relative md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      <main id="main-content" className="flex-1 overflow-auto pt-14 md:pt-0">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      <CommandPalette isOpen={cmdkOpen} onClose={() => setCmdkOpen(false)} />
    </div>
  );
}
