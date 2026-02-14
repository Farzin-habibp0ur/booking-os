'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { usePack, VerticalPackProvider } from '@/lib/vertical-pack';
import { ToastProvider } from '@/lib/toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { cn } from '@/lib/cn';
import {
  LayoutDashboard, MessageSquare, Calendar, Users, BookOpen,
  Scissors, UserCog, BarChart3, Settings, LogOut,
} from 'lucide-react';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <VerticalPackProvider>
      <ToastProvider>
        <ShellInner>{children}</ShellInner>
      </ToastProvider>
    </VerticalPackProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const pack = usePack();

  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/inbox', label: 'Inbox', icon: MessageSquare },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/customers', label: `${pack.labels.customer}s`, icon: Users },
    { href: '/bookings', label: `${pack.labels.booking}s`, icon: BookOpen },
    { href: '/services', label: `${pack.labels.service}s`, icon: Scissors },
    { href: '/staff', label: 'Staff', icon: UserCog },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-brand-600">Booking OS</h1>
          <p className="text-xs text-gray-500 truncate">{user?.business?.name}</p>
          {pack.name !== 'general' && (
            <p className="text-[10px] text-blue-500 mt-0.5 capitalize">{pack.name} Pack</p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                pathname.startsWith(href)
                  ? 'bg-brand-50 text-brand-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t">
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 w-full"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto"><ErrorBoundary>{children}</ErrorBoundary></main>
    </div>
  );
}
