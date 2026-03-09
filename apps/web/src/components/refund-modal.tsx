'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/cn';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payment: {
    id: string;
    amount: number;
    method: string;
    refundedAmount?: number;
  };
}

export default function RefundModal({ isOpen, onClose, onSuccess, payment }: RefundModalProps) {
  const maxRefundable = payment.amount - (payment.refundedAmount || 0);
  const [amount, setAmount] = useState(maxRefundable.toFixed(2));
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();
  const { toast } = useToast();

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amount);
  const isValid = parsedAmount > 0 && parsedAmount <= maxRefundable;

  const handleSubmit = async () => {
    if (!isValid) return;

    setSubmitting(true);
    try {
      await api.post('/refunds', {
        paymentId: payment.id,
        amount: parsedAmount,
        reason: reason || undefined,
      });
      toast(t('refund.success') || 'Refund processed successfully');
      onSuccess();
      onClose();
      // Reset
      setStep('form');
      setAmount(maxRefundable.toFixed(2));
      setReason('');
    } catch (e: any) {
      toast(e.message || 'Failed to process refund', 'error');
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
          <h2 className="text-lg font-serif font-semibold text-slate-900">Issue Refund</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {step === 'form' ? (
          <div className="p-4 space-y-4">
            {/* Payment info */}
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Original payment</span>
                <span className="font-medium">${payment.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-slate-500">Method</span>
                <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{payment.method}</span>
              </div>
              {(payment.refundedAmount || 0) > 0 && (
                <div className="flex justify-between mt-1">
                  <span className="text-slate-500">Already refunded</span>
                  <span className="text-red-600">${(payment.refundedAmount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between mt-1 pt-1 border-t border-slate-200">
                <span className="text-slate-700 font-medium">Refundable</span>
                <span className="font-medium">${maxRefundable.toFixed(2)}</span>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Refund Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={maxRefundable}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-transparent rounded-xl pl-7 pr-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
                />
              </div>
              {parsedAmount > maxRefundable && (
                <p className="text-xs text-red-500 mt-1">Amount exceeds refundable balance</p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reason <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this refund being issued?"
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
                onClick={() => setStep('confirm')}
                disabled={!isValid}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          /* Confirmation step */
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Confirm Refund</p>
              <p className="text-sm text-slate-500 mt-1">
                Are you sure you want to refund{' '}
                <span className="font-semibold text-red-600">${parsedAmount.toFixed(2)}</span>?
              </p>
              {reason && <p className="text-xs text-slate-400 mt-2 italic">Reason: {reason}</p>}
            </div>
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setStep('form')}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {submitting ? 'Processing...' : 'Process Refund'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
