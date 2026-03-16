'use client';

import { ReactNode, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useKeyboardShortcut, useChordShortcut } from '@/lib/use-keyboard-shortcut';
import { useAuth } from '@/lib/auth';
import { usePack, VerticalPackProvider } from '@/lib/vertical-pack';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { ToastProvider } from '@/lib/toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { LanguagePicker } from '@/components/language-picker';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
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
  Megaphone,
  Zap,
  Sun,
  Moon,
  X,
  Package,
  Kanban,
  Compass,
  FileText,
  Pin,
  Bookmark,
  Star,
  Flag,
  Heart,
  Eye,
  Bell,
  Sparkles,
  Receipt,
  Car,
} from 'lucide-react';
import CommandPalette from '@/components/command-palette';
import NotificationBell from '@/components/notification-bell';
import { useTheme } from '@/lib/use-theme';
import { DemoTourProvider, useDemoTour, TourSpotlight, TourTooltip } from '@/components/demo-tour';
import { ModeProvider, useMode } from '@/lib/use-mode';
import ModeSwitcher from '@/components/mode-switcher';
import { ViewAsBanner } from '@/components/view-as-banner';
import { TrialBanner } from '@/components/trial-banner';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { ActivationWidget } from '@/components/activation-widget';
import { NpsSurvey } from '@/components/nps-survey';
import { HelpButton } from '@/components/help-button';
import { InstallPrompt } from '@/components/install-prompt';

const SAVED_VIEW_ICONS: Record<string, any> = {
  filter: Search,
  star: Star,
  flag: Flag,
  bookmark: Bookmark,
  heart: Heart,
  eye: Eye,
  bell: Bell,
  zap: Zap,
};

export function Shell({ children }: { children: ReactNode }) {
  return (
    <VerticalPackProvider>
      <I18nProvider>
        <ToastProvider>
          <DemoTourProvider>
            <ModeProvider>
              <ShellInner>{children}</ShellInner>
            </ModeProvider>
          </DemoTourProvider>
        </ToastProvider>
      </I18nProvider>
    </VerticalPackProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const pack = usePack();
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();
  const { state: tourState, startTour } = useDemoTour();
  const { modeDef } = useMode();
  const [pinnedViews, setPinnedViews] = useState<any[]>([]);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Load sidebar-pinned saved views
  const loadPinnedViews = useCallback(async () => {
    try {
      const views = await api.get<any[]>('/saved-views/pinned');
      setPinnedViews(views || []);
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    loadPinnedViews();
  }, [loadPinnedViews]);

  // Global keyboard shortcuts
  useKeyboardShortcut('k', () => setCmdkOpen((prev) => !prev), {
    meta: true,
    preventDefault: true,
  });
  useKeyboardShortcut(
    '/',
    () => {
      const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
      if (searchInput) {
        searchInput.focus();
      }
    },
    { preventDefault: true },
  );
  useKeyboardShortcut('n', () => router.push('/bookings?new=1'));
  useChordShortcut('g', {
    b: () => router.push('/bookings'),
    c: () => router.push('/customers'),
    i: () => router.push('/inbox'),
    d: () => router.push('/dashboard'),
    s: () => router.push('/services'),
    a: () => router.push('/automations'),
    m: () => router.push('/marketing/queue'),
    q: () => router.push('/ai/actions'),
  });

  const role = user?.role;

  const allNav = [
    {
      href: '/dashboard',
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
    { href: '/inbox', label: t('nav.inbox'), icon: MessageSquare, roles: ['ADMIN', 'AGENT'] },
    { href: '/waitlist', label: 'Waitlist', icon: ClipboardList, roles: ['ADMIN', 'AGENT'] },
    {
      href: '/calendar',
      label: t('nav.calendar'),
      icon: Calendar,
      roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
    },
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
    { href: '/inventory', label: 'Inventory', icon: Car, roles: ['ADMIN', 'AGENT'] },
    { href: '/pipeline', label: 'Pipeline', icon: Compass, roles: ['ADMIN', 'AGENT'] },
    { href: '/invoices', label: 'Invoices', icon: Receipt, roles: ['ADMIN'] },
    { href: '/campaigns', label: 'Campaigns', icon: Megaphone, roles: ['ADMIN'] },
    { href: '/automations', label: 'Automations', icon: Zap, roles: ['ADMIN'] },
    { href: '/marketing/queue', label: 'Content Queue', icon: FileText, roles: ['ADMIN'] },
    { href: '/marketing/agents', label: 'Marketing Agents', icon: Zap, roles: ['ADMIN'] },
    { href: '/marketing/sequences', label: 'Email Sequences', icon: Megaphone, roles: ['ADMIN'] },
    {
      href: '/marketing/rejection-analytics',
      label: 'Rejection Analytics',
      icon: BarChart3,
      roles: ['ADMIN'],
    },
    ...((user?.business?.packConfig as any)?.kanbanEnabled
      ? [
          {
            href: '/service-board',
            label: 'Service Board',
            icon: Kanban,
            roles: ['ADMIN', 'AGENT', 'SERVICE_PROVIDER'],
          },
        ]
      : []),
    { href: '/reports', label: t('nav.reports'), icon: BarChart3, roles: ['ADMIN', 'AGENT'] },
    ...(pack.name !== 'general'
      ? [{ href: '/roi', label: t('nav.roi'), icon: TrendingUp, roles: ['ADMIN'] }]
      : []),
    { href: '/ai', label: 'AI & Agents', icon: Sparkles, roles: ['ADMIN'] },
    { href: '/ai/actions', label: 'Action Triage', icon: ClipboardList, roles: ['ADMIN'] },
    { href: '/ai/agents', label: 'Agent Status', icon: Zap, roles: ['ADMIN'] },
    { href: '/ai/performance', label: 'Performance', icon: TrendingUp, roles: ['ADMIN'] },
    {
      href: '/admin/pack-builder',
      label: 'Pack Builder',
      icon: Package,
      roles: ['SUPER_ADMIN'],
    },
  ];

  const nav = allNav.filter((item) => !role || item.roles.includes(role));

  // 3-section nav model: Workspace / Tools / Insights
  const sections = modeDef?.sections;
  const workspaceNav = nav.filter((item) => sections?.workspace.includes(item.href));
  const toolsNav = nav.filter((item) => sections?.tools.includes(item.href));
  const insightsNav = nav.filter((item) => sections?.insights.includes(item.href));
  const marketingAiNav = nav.filter((item) => sections?.marketingAi?.includes(item.href));
  // Items not in any section (e.g. pack-builder for SUPER_ADMIN)
  const extraNav = nav.filter(
    (item) =>
      item.href !== '/settings' &&
      !sections?.workspace.includes(item.href) &&
      !sections?.tools.includes(item.href) &&
      !sections?.insights.includes(item.href) &&
      !sections?.marketingAi?.includes(item.href),
  );

  const renderNavLink = ({ href, label, icon: Icon }: (typeof nav)[0]) => (
    <Link
      key={href}
      href={href}
      aria-current={pathname.startsWith(href) ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors btn-press',
        pathname.startsWith(href)
          ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 font-medium border-l-2 border-sage-600 dark:border-sage-500'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
  );

  const sidebarContent = (
    <>
      <header
        className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"
        role="banner"
      >
        <div>
          <p className="text-lg font-serif font-bold text-slate-900">{t('app.title')}</p>
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
      </header>
      <div className="px-2 pt-2">
        <ModeSwitcher />
      </div>
      <div className="mx-2 mt-2 flex items-center gap-1">
        <button
          onClick={() => setCmdkOpen(true)}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors"
          aria-label="Search (⌘K)"
        >
          <Search size={16} />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            ⌘K
          </kbd>
        </button>
        <NotificationBell />
      </div>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="flex-1 p-2 space-y-0.5 overflow-y-auto"
      >
        {/* WORKSPACE section */}
        {workspaceNav.length > 0 && (
          <>
            <p className="nav-section-label">
              {t('nav.section_workspace', undefined) || 'Workspace'}
            </p>
            {workspaceNav.map(renderNavLink)}
          </>
        )}

        {/* TOOLS section */}
        {toolsNav.length > 0 && (
          <>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <p className="nav-section-label">{t('nav.section_tools', undefined) || 'Tools'}</p>
            {toolsNav.map(renderNavLink)}
          </>
        )}

        {/* INSIGHTS section */}
        {insightsNav.length > 0 && (
          <>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <p className="nav-section-label">
              {t('nav.section_insights', undefined) || 'Insights'}
            </p>
            {insightsNav.map(renderNavLink)}
          </>
        )}

        {/* MARKETING AI section */}
        {marketingAiNav.length > 0 && (
          <>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <p className="nav-section-label flex items-center gap-1">
              <Sparkles size={12} />
              {t('nav.section_marketing_ai', undefined) || 'Marketing AI'}
            </p>
            {marketingAiNav.map(renderNavLink)}
          </>
        )}

        {/* Extra items (SUPER_ADMIN pack-builder, etc.) */}
        {extraNav.length > 0 && (
          <>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            {extraNav.map(renderNavLink)}
          </>
        )}
      </nav>
      {/* Onboarding Checklist */}
      {(user?.business as Record<string, unknown>)?.onboardingComplete !== true && (
        <OnboardingChecklist />
      )}
      {/* Activation Widget */}
      <ActivationWidget />
      {/* Sidebar Pinned Views */}
      {pinnedViews.length > 0 && (
        <div
          className="px-2 pb-2 border-t border-slate-100 dark:border-slate-800 pt-2"
          data-testid="pinned-views-section"
        >
          <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {t('saved_views.views_label')}
          </p>
          {pinnedViews.map((view) => {
            const ViewIcon = SAVED_VIEW_ICONS[view.icon] || Bookmark;
            return (
              <Link
                key={view.id}
                href={`/${view.page}?viewId=${view.id}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors',
                  pathname === `/${view.page}`
                    ? 'text-sage-700 dark:text-sage-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
              >
                <ViewIcon size={14} />
                <span className="truncate text-xs">{view.name}</span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
        {/* Settings — moved from nav to footer for cleanliness */}
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors btn-press',
            pathname.startsWith('/settings')
              ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 font-medium'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
          )}
        >
          <Settings size={18} />
          {t('nav.settings')}
        </Link>
        <button
          onClick={startTour}
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-lavender-600 dark:text-lavender-400 hover:bg-lavender-50 dark:hover:bg-lavender-900/20 w-full transition-colors"
        >
          <Compass size={18} />
          Start Tour
        </button>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 w-full transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <div className="px-3 py-1">
          <LanguagePicker />
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 w-full transition-colors"
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
          'fixed inset-y-0 left-0 z-40 w-56 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col transform transition-transform duration-200',
          'md:relative md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      <main
        id="main-content"
        className="flex-1 flex flex-col min-h-0 md:pt-0 pb-16 md:pb-0 dark:bg-slate-950 animate-page-fade"
      >
        <ViewAsBanner />
        <TrialBanner />
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 flex flex-col overflow-auto">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-around safe-bottom"
        role="tablist"
        aria-label="Mobile navigation"
      >
        {/* Calendar */}
        <Link
          href="/calendar"
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative',
            pathname.startsWith('/calendar')
              ? 'text-sage-600 dark:text-sage-400 tab-active'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
          )}
          aria-current={pathname.startsWith('/calendar') ? 'page' : undefined}
          role="tab"
        >
          <Calendar size={24} />
          <span className="text-[10px] mt-1">Calendar</span>
        </Link>

        {/* Inbox */}
        <Link
          href="/inbox"
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative',
            pathname.startsWith('/inbox')
              ? 'text-sage-600 dark:text-sage-400 tab-active'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
          )}
          aria-current={pathname.startsWith('/inbox') ? 'page' : undefined}
          role="tab"
        >
          <MessageSquare size={24} />
          <span className="text-[10px] mt-1">Inbox</span>
        </Link>

        {/* Clients/Customers */}
        <Link
          href="/customers"
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative',
            pathname.startsWith('/customers')
              ? 'text-sage-600 dark:text-sage-400 tab-active'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
          )}
          aria-current={pathname.startsWith('/customers') ? 'page' : undefined}
          role="tab"
        >
          <Users size={24} />
          <span className="text-[10px] mt-1">Clients</span>
        </Link>

        {/* Home/Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative',
            pathname.startsWith('/dashboard')
              ? 'text-sage-600 dark:text-sage-400 tab-active'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
          )}
          aria-current={pathname.startsWith('/dashboard') ? 'page' : undefined}
          role="tab"
        >
          <LayoutDashboard size={24} />
          <span className="text-[10px] mt-1">Home</span>
        </Link>

        {/* More */}
        <button
          onClick={() => setMoreSheetOpen(true)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative',
            moreSheetOpen
              ? 'text-sage-600 dark:text-sage-400 tab-active'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
          )}
          aria-label="More options"
          role="tab"
        >
          <Menu size={24} />
          <span className="text-[10px] mt-1">More</span>
        </button>
      </nav>

      {/* More sheet backdrop */}
      {moreSheetOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-black/30 animate-fade-in"
          onClick={() => setMoreSheetOpen(false)}
        />
      )}

      {/* More sheet */}
      {moreSheetOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-slate-900 rounded-t-2xl animate-slide-in-from-bottom max-h-[80vh] overflow-y-auto safe-bottom">
          <div className="p-4">
            {/* Sheet handle */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Business info */}
            <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                {user?.business?.name}
              </h2>
              {pack.name !== 'general' && (
                <p className="text-xs text-sage-600 dark:text-sage-400 mt-1 capitalize">
                  {pack.name} Pack
                </p>
              )}
            </div>

            {/* More nav items */}
            <nav className="space-y-1 px-2 mb-4">
              {toolsNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors',
                      pathname.startsWith(item.href)
                        ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                    )}
                    onClick={() => setMoreSheetOpen(false)}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
              {insightsNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors',
                      pathname.startsWith(item.href)
                        ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                    )}
                    onClick={() => setMoreSheetOpen(false)}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
              {marketingAiNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors',
                      pathname.startsWith(item.href)
                        ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                    )}
                    onClick={() => setMoreSheetOpen(false)}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
              {extraNav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors',
                      pathname.startsWith(item.href)
                        ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                    )}
                    onClick={() => setMoreSheetOpen(false)}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* More sheet action buttons */}
            <div className="space-y-1 px-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Link
                href="/settings"
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors',
                  pathname.startsWith('/settings')
                    ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
                onClick={() => setMoreSheetOpen(false)}
              >
                <Settings size={20} />
                {t('nav.settings')}
              </Link>
              <button
                onClick={() => {
                  toggleTheme();
                  setMoreSheetOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 w-full transition-colors"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <div className="px-4 py-2">
                <LanguagePicker />
              </div>
              <button
                onClick={() => {
                  logout();
                  setMoreSheetOpen(false);
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 w-full transition-colors"
              >
                <LogOut size={20} />
                {t('nav.logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      <InstallPrompt />
      <HelpButton />
      <NpsSurvey />
      <CommandPalette isOpen={cmdkOpen} onClose={() => setCmdkOpen(false)} />
      {tourState === 'running' && (
        <>
          <TourSpotlight />
          <TourTooltip />
        </>
      )}
    </div>
  );
}
