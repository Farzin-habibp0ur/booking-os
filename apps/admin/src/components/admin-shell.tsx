'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { ViewAsBanner } from '@/components/view-as-banner';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Bot,
  MessageSquare,
  LifeBuoy,
  ScrollText,
  Activity,
  Settings,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Megaphone,
} from 'lucide-react';

const adminNav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/businesses', label: 'Businesses', icon: Building2 },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/packs', label: 'Packs & Skills', icon: Package },
  { href: '/agents', label: 'AI Agents', icon: Bot },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/messaging', label: 'Messaging', icon: MessageSquare },
  { href: '/support', label: 'Support', icon: LifeBuoy },
  { href: '/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/health', label: 'System Health', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      {/* Logo area */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-serif font-bold text-white">BookingOS</span>
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded font-medium">
            ADMIN
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden text-slate-400 hover:text-white transition-colors"
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav
        role="navigation"
        aria-label="Admin navigation"
        className="flex-1 p-2 space-y-0.5 overflow-y-auto"
      >
        {adminNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
              isActive(href)
                ? 'bg-slate-800 text-white font-medium border-l-2 border-sage-500'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white',
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-slate-800 space-y-1">
        <p className="px-3 py-1 text-xs text-slate-500 truncate">{user.email}</p>
        <a
          href="https://businesscommandcentre.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-800 hover:text-white w-full transition-colors"
        >
          <ExternalLink size={18} />
          View Customer App
        </a>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-800 hover:text-white w-full transition-colors"
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
      <div className="fixed top-0 left-0 right-0 z-30 md:hidden bg-slate-900 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-slate-400 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="text-sm font-serif font-bold text-white truncate">BookingOS Admin</span>
        <div className="ml-auto w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">
          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col transform transition-transform duration-200',
          'md:relative md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      <main id="main-content" className="flex-1 overflow-auto pt-14 md:pt-0 bg-slate-50">
        <ViewAsBanner />
        {children}
      </main>
    </div>
  );
}
