'use client';

import { useEffect, useState } from 'react';
import { Package, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface PackageRedeemSelectorProps {
  customerId: string;
  serviceId: string;
  bookingId?: string;
  onSelect: (purchaseId: string | null) => void;
}

interface ActivePurchase {
  id: string;
  totalSessions: number;
  usedSessions: number;
  expiresAt: string;
  package: {
    id: string;
    name: string;
    serviceId: string | null;
    service: { id: string; name: string } | null;
  };
}

export default function PackageRedeemSelector({
  customerId,
  serviceId,
  bookingId,
  onSelect,
}: PackageRedeemSelectorProps) {
  const [purchases, setPurchases] = useState<ActivePurchase[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!customerId || !serviceId) {
      setPurchases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch(`/packages/customer/${customerId}/active?serviceId=${serviceId}`)
      .then((data: any) => setPurchases(Array.isArray(data) ? data : []))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, [customerId, serviceId]);

  const handleSelect = (purchaseId: string | null) => {
    setSelected(purchaseId);
    onSelect(purchaseId);
  };

  const handleRedeem = async (purchaseId: string) => {
    if (!bookingId) return;
    setRedeeming(true);
    try {
      await apiFetch(`/packages/purchases/${purchaseId}/redeem`, {
        method: 'POST',
        body: JSON.stringify({ bookingId }),
      });
      handleSelect(purchaseId);
    } catch {
      // silently fail — booking can proceed without package
    } finally {
      setRedeeming(false);
    }
  };

  if (loading || purchases.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-lavender-100 bg-lavender-50/50 p-4"
      data-testid="package-redeem-selector"
    >
      <div className="flex items-center gap-2 mb-3">
        <Package size={16} className="text-lavender-600" />
        <span className="text-sm font-medium text-slate-700">Active Packages Available</span>
      </div>

      <div className="space-y-2">
        {purchases.map((p) => {
          const remaining = p.totalSessions - p.usedSessions;
          const isSelected = selected === p.id;

          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                bookingId ? handleRedeem(p.id) : handleSelect(isSelected ? null : p.id)
              }
              disabled={redeeming}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                isSelected ? 'bg-sage-50 ring-2 ring-sage-500' : 'bg-white hover:bg-slate-50'
              }`}
            >
              <div>
                <p className="text-sm font-medium text-slate-700">{p.package.name}</p>
                <p className="text-xs text-slate-500">
                  {remaining} of {p.totalSessions} sessions remaining
                  {' • '}
                  Expires {new Date(p.expiresAt).toLocaleDateString()}
                </p>
              </div>
              {isSelected ? (
                <div className="w-5 h-5 rounded-full bg-sage-500 flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              ) : (
                <span className="text-xs text-sage-600 font-medium">Use session</span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`mt-2 w-full p-2 rounded-lg text-xs transition-colors ${
          selected === null ? 'text-sage-700 font-medium' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        Pay full price instead
      </button>
    </div>
  );
}
