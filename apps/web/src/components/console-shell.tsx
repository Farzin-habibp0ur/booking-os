'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Bot,
  MessageSquare,
  LifeBuoy,
  Shield,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const consoleNav = [
  { href: '/console', label: 'Overview', icon: LayoutDashboard },
  { href: '/console/businesses', label: 'Businesses', icon: Building2 },
  { href: '/console/billing', label: 'Billing', icon: CreditCard },
  { href: '/console/packs', label: 'Packs & Skills', icon: Package },
  { href: '/console/agents', label: 'AI & Agents', icon: Bot },
  { href: '/console/messaging', label: 'Messaging Ops', icon: MessageSquare },
  { href: '/console/support', label: 'Support', icon: LifeBuoy },
  { href: '/console/audit', label: 'Security & Audit', icon: Shield },
  { href: '/console/health', label: 'System Health', icon: Activity },
  { href: '/console/settings', label: 'Settings', icon: Settings },
];

export function ConsoleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && user && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600" />
      </div>
    );
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/console') return pathname === '/console';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-serif font-bold text-slate-900 dark:text-white">
            Platform Console
          </h1>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>
      <nav
        role="navigation"
        aria-label="Console navigation"
        className="flex-1 p-2 space-y-0.5 overflow-y-auto"
      >
        {consoleNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              isActive(href)
                ? 'bg-sage-50 dark:bg-sage-900/20 text-sage-700 dark:text-sage-400 font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 w-full transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-sage-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-xl"
      >
        Skip to main content
      </a>

      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-slate-600 hover:text-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-sm font-serif font-bold text-slate-900 truncate">Platform Console</h1>
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
          'fixed inset-y-0 left-0 z-40 w-56 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col transform transition-transform duration-200',
          'md:relative md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      <main id="main-content" className="flex-1 overflow-auto pt-14 md:pt-0 dark:bg-slate-950">
        {children}
      </main>
    </div>
  );
}
