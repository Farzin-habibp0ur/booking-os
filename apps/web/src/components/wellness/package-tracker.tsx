'use client';

import { useEffect, useState } from 'react';
import { Package, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { apiFetch } from '@/lib/api';

interface PackageTrackerProps {
  customerId?: string;
  sessions?: {
    total: number;
    used: number;
    packageName: string;
    expiresAt?: string;
  };
}

interface PurchaseData {
  id: string;
  totalSessions: number;
  usedSessions: number;
  expiresAt: string;
  status: string;
  package: { name: string };
}

export default function PackageTracker({ customerId, sessions }: PackageTrackerProps) {
  const [purchases, setPurchases] = useState<PurchaseData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    apiFetch(`/packages/customer/${customerId}/active`)
      .then((data: any) => setPurchases(Array.isArray(data) ? data : []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, [customerId]);

  // Build display items from API data or static props
  const items: { total: number; used: number; packageName: string; expiresAt?: string }[] = [];

  if (purchases.length > 0) {
    purchases.forEach((p) => {
      items.push({
        total: p.totalSessions,
        used: p.usedSessions,
        packageName: p.package.name,
        expiresAt: p.expiresAt,
      });
    });
  } else if (sessions) {
    items.push(sessions);
  }

  if (loading) {
    return (
      <div
        className="bg-white rounded-2xl shadow-soft p-5 animate-pulse"
        data-testid="package-tracker"
      >
        <div className="h-4 bg-slate-100 rounded w-32 mb-3" />
        <div className="h-2 bg-slate-100 rounded w-full mb-2" />
        <div className="h-3 bg-slate-100 rounded w-24" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="package-tracker">
      {items.map((item, idx) => {
        const remaining = item.total - item.used;
        const progress = item.total > 0 ? (item.used / item.total) * 100 : 0;
        const isExpiringSoon =
          item.expiresAt &&
          new Date(item.expiresAt).getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000;

        return (
          <div key={idx} className="bg-white rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-lavender-50 flex items-center justify-center">
                  <Package size={14} className="text-lavender-600" />
                </div>
                <span className="text-sm font-semibold text-slate-800">Session Package</span>
              </div>
              <div className="flex items-center gap-1 text-sage-600">
                <TrendingUp size={14} />
                <span className="text-xs font-medium">{Math.round(progress)}%</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-2">{item.packageName}</p>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progress >= 80 ? 'bg-amber-400' : 'bg-sage-500',
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {item.used} of {item.total} sessions used
              </span>
              <span
                className={cn(
                  'text-xs font-medium',
                  remaining <= 2 ? 'text-amber-600' : 'text-sage-600',
                )}
              >
                {remaining} remaining
              </span>
            </div>

            {isExpiringSoon && (
              <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                Expires {new Date(item.expiresAt!).toLocaleDateString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
