'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DetailSkeleton } from '@/components/skeleton';
import { INVOICE_STATUS_STYLES, invoiceBadgeClasses } from '@/lib/design-tokens';
import {
  ArrowLeft,
  Send,
  DollarSign,
  FileText,
  X,
  Plus,
  Trash2,
  Ban,
} from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  service?: { name: string };
}

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  taxRate: number | null;
  taxAmount: number | null;
  discountAmount: number | null;
  total: number;
  paidAmount: number;
  currency: string;
  dueDate: string;
  notes: string | null;
  terms: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string; phone: string };
  booking?: { id: string; service: { name: string }; staff?: { name: string }; startTime: string };
  lineItems: LineItem[];
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    createdAt: string;
    reference: string | null;
  }>;
  business: { name: string; logoUrl: string | null; phone: string | null };
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', reference: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const res = await api.get<InvoiceDetail>(`/invoices/${id}`);
      setInvoice(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!invoice) return;
    setSubmitting(true);
    try {
      await api.post(`/invoices/${id}/send`, {});
      loadInvoice();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice || !confirm('Cancel this invoice?')) return;
    try {
      await api.post(`/invoices/${id}/cancel`, {});
      loadInvoice();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRecordPayment = async () => {
    if (!invoice) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/invoices/${id}/record-payment`, {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      });
      setPaymentModal(false);
      setPaymentForm({ amount: '', method: 'CASH', reference: '', notes: '' });
      loadInvoice();
    } catch (e: any) {
      setError(e.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6"><DetailSkeleton /></div>;
  if (!invoice) return <div className="p-6 text-slate-500">Invoice not found</div>;

  const remaining = Number(invoice.total) - Number(invoice.paidAmount);
  const canPay = ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status);
  const isDraft = invoice.status === 'DRAFT';

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/invoices')}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={18} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-serif font-semibold text-slate-900">
                {invoice.invoiceNumber}
              </h1>
              <p className="text-xs text-slate-500">{invoice.customer.name}</p>
            </div>
            <span
              className={cn(
                'px-2.5 py-0.5 text-xs rounded-full ml-2',
                invoiceBadgeClasses(invoice.status),
              )}
            >
              {INVOICE_STATUS_STYLES[invoice.status]?.label || invoice.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isDraft && (
              <button
                onClick={handleSend}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                <Send size={14} />
                Send Invoice
              </button>
            )}
            {canPay && (
              <button
                onClick={() => {
                  setPaymentForm({ ...paymentForm, amount: remaining.toFixed(2) });
                  setPaymentModal(true);
                  setError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white text-xs rounded-xl transition-colors"
              >
                <DollarSign size={14} />
                Record Payment
              </button>
            )}
            {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 text-xs rounded-xl transition-colors"
              >
                <Ban size={14} />
                Cancel
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-xs px-4 py-2 rounded-xl">{error}</div>
        )}

        {/* Invoice info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-soft p-5 space-y-3">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</h3>
            <div>
              <p className="text-sm font-medium text-slate-900">{invoice.customer.name}</p>
              {invoice.customer.email && (
                <p className="text-xs text-slate-500">{invoice.customer.email}</p>
              )}
              {invoice.customer.phone && (
                <p className="text-xs text-slate-500">{invoice.customer.phone}</p>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-soft p-5 space-y-3">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Details</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-700">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date</span>
                <span className={cn('font-medium', invoice.status === 'OVERDUE' ? 'text-red-600' : 'text-slate-700')}>
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </span>
              </div>
              {invoice.sentAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Sent</span>
                  <span className="text-slate-700">
                    {new Date(invoice.sentAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid</span>
                  <span className="text-sage-700 font-medium">
                    {new Date(invoice.paidAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Line Items</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-2 text-xs font-medium text-slate-500">Description</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 w-20">Qty</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 w-28">Price</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-slate-500 w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li) => (
                <tr key={li.id} className="border-b border-slate-50">
                  <td className="px-5 py-3 text-slate-900">
                    {li.description}
                    {li.service && (
                      <span className="text-xs text-slate-400 ml-1">({li.service.name})</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-600">{li.quantity}</td>
                  <td className="px-5 py-3 text-right text-slate-600">${Number(li.unitPrice).toFixed(2)}</td>
                  <td className="px-5 py-3 text-right font-medium text-slate-900">${Number(li.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t border-slate-100 px-5 py-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-700">${Number(invoice.subtotal).toFixed(2)}</span>
            </div>
            {invoice.discountAmount != null && Number(invoice.discountAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Discount</span>
                <span className="text-red-600">-${Number(invoice.discountAmount).toFixed(2)}</span>
              </div>
            )}
            {invoice.taxAmount != null && Number(invoice.taxAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">
                  Tax{invoice.taxRate ? ` (${(Number(invoice.taxRate) * 100).toFixed(2)}%)` : ''}
                </span>
                <span className="text-slate-700">${Number(invoice.taxAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-slate-100">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900">${Number(invoice.total).toFixed(2)}</span>
            </div>
            {Number(invoice.paidAmount) > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-sage-600">Paid</span>
                  <span className="text-sage-700">-${Number(invoice.paidAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-slate-900">Balance Due</span>
                  <span className={cn(remaining > 0 ? 'text-amber-600' : 'text-sage-700')}>
                    ${remaining.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes & Terms */}
        {(invoice.notes || invoice.terms) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {invoice.notes && (
              <div className="bg-white rounded-2xl shadow-soft p-5">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div className="bg-white rounded-2xl shadow-soft p-5">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Terms</h3>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{invoice.terms}</p>
              </div>
            )}
          </div>
        )}

        {/* Payment history */}
        {invoice.payments.length > 0 && (
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Payment History
            </h3>
            <div className="space-y-2">
              {invoice.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
                >
                  <div>
                    <p className="text-sm text-slate-700">
                      ${Number(p.amount).toFixed(2)} via {p.method}
                    </p>
                    {p.reference && (
                      <p className="text-xs text-slate-400">Ref: {p.reference}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center animate-backdrop">
          <div className="bg-white rounded-2xl shadow-soft p-6 w-full max-w-sm mx-4 animate-modal-enter">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Record Payment</h3>
              <button
                onClick={() => setPaymentModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5"
                  aria-label="Payment method"
                >
                  {['CASH', 'CARD', 'BANK_TRANSFER', 'STRIPE', 'OTHER'].map((m) => (
                    <option key={m} value={m}>
                      {m.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Reference (optional)</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm p-2.5"
                />
              </div>
              {error && <p className="text-red-600 text-xs">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setPaymentModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={submitting || !paymentForm.amount}
                className="px-3 py-1.5 text-xs bg-sage-600 hover:bg-sage-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
