'use client';

import { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useKeyboardShortcut, useChordShortcut } from '@/lib/use-keyboard-shortcut';
import { splitSectionPaths } from '@/lib/mode-config';
import { getNavItems } from '@/lib/nav-config';
import { useAuth } from '@/lib/auth';
import { usePack, VerticalPackProvider } from '@/lib/vertical-pack';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { ToastProvider } from '@/lib/toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { LanguagePicker } from '@/components/language-picker';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import {
  Settings,
  LogOut,
  Menu,
  Search,
  Zap,
  Sun,
  Moon,
  X,
  Compass,
  Pin,
  Bookmark,
  Star,
  Flag,
  Heart,
  Eye,
  Bell,
  Sparkles,
  ChevronDown,
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
  const { modeDef, landingPath } = useMode();
  const [pinnedViews, setPinnedViews] = useState<any[]>([]);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('bookingos-nav-more-open') === 'true';
    } catch {
      return false;
    }
  });
  const navRef = useRef<HTMLElement>(null);
  const [navCanScroll, setNavCanScroll] = useState(false);
  const [navAtBottom, setNavAtBottom] = useState(false);

  const toggleOverflow = useCallback(() => {
    setOverflowOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bookingos-nav-more-open', String(next));
      } catch {
        // Silently handle
      }
      return next;
    });
  }, []);

  // Track nav scroll state for fade indicator
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const check = () => {
      const canScroll = nav.scrollHeight > nav.clientHeight;
      setNavCanScroll(canScroll);
      setNavAtBottom(!canScroll || nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 2);
    };
    check();
    nav.addEventListener('scroll', check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(nav);
    return () => {
      nav.removeEventListener('scroll', check);
      observer.disconnect();
    };
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Post-login redirect: land on mode-specific default page once
  useEffect(() => {
    if (pathname !== '/dashboard' && pathname !== '/') return;
    try {
      const flag = sessionStorage.getItem('booking-os-login-redirect');
      if (!flag) return;
      sessionStorage.removeItem('booking-os-login-redirect');
      if (landingPath && landingPath !== '/dashboard') {
        router.replace(landingPath);
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [pathname, landingPath, router]);

  // Redirect when current pathname is not allowed for the active mode
  useEffect(() => {
    if (!modeDef || !user) return;
    const s = modeDef.sections;
    const allowed = new Set([
      ...s.workspace,
      ...s.tools,
      ...s.insights,
      ...(s.aiAgents || []),
      '/settings',
    ]);
    const isAllowed =
      pathname === '/' ||
      pathname.startsWith('/settings') ||
      pathname.startsWith('/admin/') ||
      allowed.has(pathname) ||
      [...allowed].some((p) => pathname.startsWith(p + '/'));
    if (!isAllowed) {
      router.replace(modeDef.defaultLandingPath);
    }
  }, [pathname, modeDef, user, router]);

  // Load sidebar-pinned saved views
  const loadPinnedViews = useCallback(async () => {
    try {
      const views = await api.get<any[]>('/saved-views/pinned');
      const unique = views ? [...new Map(views.map((v) => [v.id, v])).values()] : [];
      setPinnedViews(unique);
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
    q: () => router.push('/ai/actions'),
    r: () => router.push('/reports'),
    j: () => router.push('/ai'),
    w: () => router.push('/waitlist'),
  });

  const role = user?.role;

  const allNav = getNavItems({
    t,
    packName: pack.name,
    packLabels: pack.labels,
    kanbanEnabled: !!(user?.business?.packConfig as any)?.kanbanEnabled,
  });

  const nav = allNav.filter((item) => !role || item.roles.includes(role));

  // 3-section nav model: Workspace / Tools / Insights — split into primary + overflow
  const sections = modeDef?.sections ?? { workspace: [], tools: [], insights: [] };
  const split = splitSectionPaths(sections);

  const workspaceNav = nav.filter((item) => split.workspace.primary.includes(item.href));
  const toolsNav = nav.filter((item) => split.tools.primary.includes(item.href));
  const insightsNav = nav.filter((item) => split.insights.primary.includes(item.href));
  const aiAgentsNav = nav.filter((item) => split.aiAgents.primary.includes(item.href));

  // Overflow items grouped by section
  const overflowToolsNav = nav.filter((item) => split.tools.overflow.includes(item.href));
  const overflowInsightsNav = nav.filter((item) => split.insights.overflow.includes(item.href));
  const overflowAiAgentsNav = nav.filter((item) => split.aiAgents.overflow.includes(item.href));
  const hasOverflow =
    overflowToolsNav.length > 0 || overflowInsightsNav.length > 0 || overflowAiAgentsNav.length > 0;

  // All paths allowed in the current mode (union of primary + overflow)
  const allSectionPaths = [
    ...sections.workspace,
    ...sections.tools,
    ...sections.insights,
    ...(sections.aiAgents || []),
  ];
  const modeAllowedHrefs = new Set(allSectionPaths);

  // Only truly global items outside any mode (e.g. SUPER_ADMIN pack-builder)
  const extraNav = nav.filter(
    (item) => !modeAllowedHrefs.has(item.href) && item.href.startsWith('/admin/'),
  );

  // Mobile tab bar: pick up to 4 tabs from workspace, prioritizing key paths.
  // Preferred order per mode: admin/agent → inbox, calendar, customers, dashboard
  //                           provider   → calendar, bookings, dashboard, services
  const mobileTabPriority: string[] =
    modeDef?.key === 'provider'
      ? ['/calendar', '/bookings', '/dashboard', '/services']
      : ['/inbox', '/calendar', '/customers', '/dashboard'];
  const mobileTabs = mobileTabPriority
    .map((href) => nav.find((n) => n.href === href))
    .filter((item): item is (typeof nav)[0] => !!item)
    .slice(0, 4)
    .map((item) => ({
      ...item,
      // Override label for /dashboard to "Home" on mobile
      label: item.href === '/dashboard' ? t('nav.home', undefined) || 'Home' : item.label,
    }));

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
      <div className="flex-1 min-h-0 relative">
        <nav
          ref={navRef}
          role="navigation"
          aria-label="Main navigation"
          className="h-full p-2 space-y-1 overflow-y-auto"
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
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <p className="nav-section-label">{t('nav.section_tools', undefined) || 'Tools'}</p>
              {toolsNav.map(renderNavLink)}
            </>
          )}

          {/* INSIGHTS section */}
          {insightsNav.length > 0 && (
            <>
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <p className="nav-section-label">
                {t('nav.section_insights', undefined) || 'Insights'}
              </p>
              {insightsNav.map(renderNavLink)}
            </>
          )}

          {/* AI & AGENTS section */}
          {aiAgentsNav.length > 0 && (
            <>
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <p className="nav-section-label flex items-center gap-1">
                <Sparkles size={12} />
                {t('nav.section_ai_agents', undefined) || 'AI & Agents'}
              </p>
              {aiAgentsNav.map(renderNavLink)}
            </>
          )}

          {/* Overflow "More" section — collapsible */}
          {hasOverflow && (
            <>
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              <button
                onClick={toggleOverflow}
                aria-expanded={overflowOpen}
                className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                data-testid="sidebar-more-toggle"
              >
                <span>{t('nav.section_more', undefined) || 'More'}</span>
                <ChevronDown
                  size={12}
                  className={cn(
                    'transition-transform duration-200',
                    overflowOpen ? 'rotate-180' : '',
                  )}
                />
              </button>
              {overflowOpen && (
                <div className="space-y-1" data-testid="sidebar-overflow-items">
                  {overflowToolsNav.length > 0 && (
                    <>
                      <p className="nav-section-label text-slate-300 dark:text-slate-600">
                        {t('nav.section_tools', undefined) || 'Tools'}
                      </p>
                      {overflowToolsNav.map(renderNavLink)}
                    </>
                  )}
                  {overflowInsightsNav.length > 0 && (
                    <>
                      <p className="nav-section-label text-slate-300 dark:text-slate-600">
                        {t('nav.section_insights', undefined) || 'Insights'}
                      </p>
                      {overflowInsightsNav.map(renderNavLink)}
                    </>
                  )}
                  {overflowAiAgentsNav.length > 0 && (
                    <>
                      <p className="nav-section-label text-slate-300 dark:text-slate-600 flex items-center gap-1">
                        <Sparkles size={10} />
                        {t('nav.section_ai_agents', undefined) || 'AI & Agents'}
                      </p>
                      {overflowAiAgentsNav.map(renderNavLink)}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Extra items (SUPER_ADMIN pack-builder, etc.) */}
          {extraNav.length > 0 && (
            <>
              <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
              {extraNav.map(renderNavLink)}
            </>
          )}
        </nav>
        {/* Scroll fade indicator */}
        {navCanScroll && !navAtBottom && (
          <div
            className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none bg-gradient-to-t from-white dark:from-slate-900 to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
      {/* Onboarding Checklist — shown until setup is complete */}
      {(user?.business as Record<string, unknown>)?.onboardingComplete !== true ? (
        <OnboardingChecklist />
      ) : (
        /* Activation Widget — shown only after onboarding is complete */
        <ActivationWidget />
      )}
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

      {/* Mobile bottom tab bar — mode + role aware */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-around safe-bottom"
        role="tablist"
        aria-label="Mobile navigation"
      >
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative',
                pathname.startsWith(tab.href)
                  ? 'text-sage-600 dark:text-sage-400 tab-active'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
              aria-current={pathname.startsWith(tab.href) ? 'page' : undefined}
              role="tab"
            >
              <Icon size={24} />
              <span className="text-[10px] mt-1">{tab.label}</span>
            </Link>
          );
        })}

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
          <span className="text-[10px] mt-1">{t('nav.more', undefined) || 'More'}</span>
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
              {aiAgentsNav.map((item) => {
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
