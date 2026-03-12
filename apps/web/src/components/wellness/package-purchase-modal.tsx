'use client';

import { useState, useEffect } from 'react';
import { Package, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface PackagePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  onPurchased?: () => void;
}

interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  totalSessions: number;
  price: string;
  currency: string;
  validityDays: number;
  service: { id: string; name: string } | null;
}

export default function PackagePurchaseModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  onPurchased,
}: PackagePurchaseModalProps) {
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    apiFetch('/packages')
      .then((data: any) => setPackages((data || []).filter((p: any) => p.isActive)))
      .catch(() => setPackages([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/packages/${selectedId}/purchase`, {
        method: 'POST',
        body: JSON.stringify({ customerId, paymentMethod, notes: notes || undefined }),
      });
      onPurchased?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to purchase package');
    } finally {
      setSaving(false);
    }
  };

  const selected = packages.find((p) => p.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-soft-lg p-6 w-full max-w-md animate-modal-enter">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-lavender-600" />
            <h2 className="text-lg font-semibold text-slate-800">Sell Package</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded-lg">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-4">
          Selling to <span className="font-medium text-slate-700">{customerName}</span>
        </p>

        {error && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded-lg text-xs">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Package</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
              aria-label="Package"
            >
              <option value="">Select a package</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.totalSessions} sessions — ${Number(p.price).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="p-3 bg-lavender-50 rounded-xl text-xs text-slate-600">
              <p className="font-medium text-slate-700">{selected.name}</p>
              <p>
                {selected.totalSessions} sessions • ${Number(selected.price).toFixed(2)} •{' '}
                {selected.validityDays} day validity
              </p>
              {selected.service && (
                <p className="text-lavender-600 mt-1">Service: {selected.service.name}</p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
              aria-label="Payment method"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="STRIPE">Stripe</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
              placeholder="Optional notes"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedId || saving}
            className="flex-1 px-4 py-2 text-sm bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 btn-press"
          >
            {saving ? 'Processing...' : 'Confirm Purchase'}
          </button>
        </div>
      </div>
    </div>
  );
}
