'use client';

import { ReactNode } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { LayoutDashboard, CalendarPlus, Receipt, FolderOpen, UserCircle, Gift } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'book', label: 'Book', icon: CalendarPlus },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'documents', label: 'Documents', icon: FolderOpen },
  { key: 'referrals', label: 'Referrals', icon: Gift },
  { key: 'profile', label: 'Profile', icon: UserCircle },
];

export default function PortalSlugLayout({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();

  // Don't show nav on the login page itself
  const isLoginPage = pathname === `/portal/${slug}`;
  if (isLoginPage) return <>{children}</>;

  const activeKey =
    NAV_ITEMS.find((item) => pathname.includes(`/portal/${slug}/${item.key}`))?.key || 'dashboard';

  return (
    <div className="space-y-0">
      {/* Navigation tabs */}
      <nav className="bg-white border-b border-slate-200 -mt-6 -mx-4 px-4 mb-6">
        <div className="flex gap-1 overflow-x-auto py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const href = `/portal/${slug}/${item.key}`;
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-sage-50 text-sage-800 font-medium'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50',
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}
