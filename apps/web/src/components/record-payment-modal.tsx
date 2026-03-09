'use client';

import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bookingId?: string;
  customerId?: string;
  customerName?: string;
  serviceName?: string;
  servicePrice?: number;
}

export default function RecordPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  bookingId,
  customerId,
  customerName,
  serviceName,
  servicePrice,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState(servicePrice?.toString() || '');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast(t('payment.invalid_amount') || 'Invalid amount', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/payments', {
        bookingId: bookingId || undefined,
        customerId: customerId || undefined,
        amount: parsedAmount,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
      });
      toast(t('payment.recorded_success') || 'Payment recorded');
      onSuccess();
      onClose();
      // Reset form
      setAmount('');
      setMethod('CASH');
      setReference('');
      setNotes('');
    } catch (e: any) {
      toast(e.message || 'Failed to record payment', 'error');
    }
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/30 animate-fade-in" onClick={onClose} />
      <div className="relative w-[440px] bg-white rounded-2xl shadow-soft animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-sage-600" />
            <h2 className="text-lg font-serif font-semibold text-slate-900">Record Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Context info (if from booking) */}
        {(customerName || serviceName) && (
          <div className="px-4 pt-3 pb-0">
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm">
              {customerName && <p className="text-slate-700 font-medium">{customerName}</p>}
              {serviceName && (
                <p className="text-slate-500 text-xs">
                  {serviceName}
                  {servicePrice ? ` · $${servicePrice}` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full bg-slate-50 border border-transparent rounded-xl pl-7 pr-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
            </div>
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full bg-slate-50 border border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reference <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Receipt number or reference"
              maxLength={500}
              className="w-full bg-slate-50 border border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this payment..."
              rows={2}
              maxLength={2000}
              className="w-full bg-slate-50 border border-transparent rounded-xl px-3 py-2 text-sm resize-none focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !amount}
              className="flex-1 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
