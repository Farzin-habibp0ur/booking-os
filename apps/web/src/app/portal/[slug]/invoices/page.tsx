'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileText, DollarSign, Clock, CreditCard, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { INVOICE_STATUS_STYLES, invoiceBadgeClasses } from '@/lib/design-tokens';
import { ListSkeleton } from '@/components/skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function portalFetch(path: string) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('portal-token') : null;
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => {
    if (r.status === 401) {
      sessionStorage.removeItem('portal-token');
      window.location.href = `/portal/${window.location.pathname.split('/')[2]}`;
      throw new Error('Unauthorized');
    }
    return r.json();
  });
}

function portalPost(path: string, body: any) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('portal-token') : null;
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (r.status === 401) {
      sessionStorage.removeItem('portal-token');
      window.location.href = `/portal/${window.location.pathname.split('/')[2]}`;
      throw new Error('Unauthorized');
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Request failed');
    return data;
  });
}

interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  paidAmount: number;
  dueDate: string;
  createdAt: string;
  currency?: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

export default function PortalInvoicesPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('portal-token');
    if (!token) {
      router.replace(`/portal/${slug}`);
      return;
    }
    loadInvoices();
  }, [slug]);

  const loadInvoices = () => {
    setLoading(true);
    portalFetch('/portal/invoices')
      .then(setInvoices)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handlePay = async (invoiceId: string) => {
    setPayingId(invoiceId);
    setPayError('');
    try {
      const { url } = await portalPost(`/portal/invoices/${invoiceId}/pay`, {
        successUrl: `${window.location.origin}/portal/${slug}/invoices?paid=true`,
        cancelUrl: `${window.location.origin}/portal/${slug}/invoices`,
      });
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setPayError(err.message || 'Failed to initiate payment');
      setPayingId(null);
    }
  };

  const handleDownloadPdf = (inv: PortalInvoice) => {
    // Generate a printable invoice HTML and trigger print/save
    const html = `<!DOCTYPE html>
<html><head><title>Invoice ${inv.invoiceNumber}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #1e293b; }
h1 { font-size: 24px; margin-bottom: 4px; }
.meta { color: #64748b; font-size: 14px; margin-bottom: 24px; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th { text-align: left; padding: 8px 0; border-bottom: 2px solid #e2e8f0; font-size: 13px; color: #64748b; }
td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.total-row { font-weight: 600; border-top: 2px solid #e2e8f0; }
.text-right { text-align: right; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; font-weight: 500; }
</style></head><body>
<h1>Invoice ${inv.invoiceNumber}</h1>
<p class="meta">
  Status: ${inv.status} · Due: ${new Date(inv.dueDate).toLocaleDateString()}<br/>
  Created: ${new Date(inv.createdAt).toLocaleDateString()}
</p>
<table>
  <thead><tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Total</th></tr></thead>
  <tbody>
    ${inv.lineItems.map((li) => `<tr><td>${li.description}</td><td class="text-right">${li.quantity}</td><td class="text-right">$${Number(li.unitPrice || 0).toFixed(2)}</td><td class="text-right">$${Number(li.total).toFixed(2)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="3">Total</td><td class="text-right">$${Number(inv.total).toFixed(2)}</td></tr>
    ${Number(inv.paidAmount) > 0 ? `<tr><td colspan="3">Paid</td><td class="text-right">$${Number(inv.paidAmount).toFixed(2)}</td></tr><tr class="total-row"><td colspan="3">Balance Due</td><td class="text-right">$${(Number(inv.total) - Number(inv.paidAmount)).toFixed(2)}</td></tr>` : ''}
  </tbody>
</table>
<script>window.print();</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const isPayable = (status: string) =>
    ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'].includes(status);

  const outstanding = invoices.filter((inv) => isPayable(inv.status));
  const outstandingTotal = outstanding.reduce(
    (sum, inv) => sum + Number(inv.total) - Number(inv.paidAmount),
    0,
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-serif font-semibold text-slate-900">My Invoices</h1>

      {/* Outstanding summary */}
      {outstanding.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-4 flex items-center gap-3">
          <DollarSign size={20} className="text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              ${outstandingTotal.toFixed(2)} outstanding
            </p>
            <p className="text-xs text-amber-600">
              {outstanding.length} invoice{outstanding.length !== 1 ? 's' : ''} pending payment
            </p>
          </div>
        </div>
      )}

      {payError && (
        <div className="bg-red-50 rounded-xl p-3 text-sm text-red-700">{payError}</div>
      )}

      {/* Invoice list */}
      <div className="space-y-3" data-testid="invoice-list">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No invoices yet</p>
          </div>
        ) : (
          invoices.map((inv) => {
            const amountDue = Number(inv.total) - Number(inv.paidAmount);
            return (
              <div key={inv.id} className="bg-white rounded-2xl shadow-soft p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{inv.invoiceNumber}</p>
                    <div className="mt-1 space-y-0.5">
                      {inv.lineItems.slice(0, 2).map((li, i) => (
                        <p key={i} className="text-xs text-slate-500">
                          {li.description}
                        </p>
                      ))}
                      {inv.lineItems.length > 2 && (
                        <p className="text-xs text-slate-400">
                          +{inv.lineItems.length - 2} more items
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        Due{' '}
                        {new Date(inv.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        invoiceBadgeClasses(inv.status),
                      )}
                    >
                      {INVOICE_STATUS_STYLES[inv.status]?.label || inv.status}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      ${Number(inv.total).toFixed(2)}
                    </span>
                    {Number(inv.paidAmount) > 0 && Number(inv.paidAmount) < Number(inv.total) && (
                      <span className="text-xs text-sage-600">
                        ${Number(inv.paidAmount).toFixed(2)} paid
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  {isPayable(inv.status) && amountDue > 0 && (
                    <button
                      onClick={() => handlePay(inv.id)}
                      disabled={payingId === inv.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-600 text-white text-xs rounded-lg hover:bg-sage-700 transition-colors disabled:opacity-50"
                      data-testid="pay-now-btn"
                    >
                      {payingId === inv.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CreditCard size={12} />
                      )}
                      {payingId === inv.id ? 'Processing...' : `Pay $${amountDue.toFixed(2)}`}
                    </button>
                  )}
                  <button
                    onClick={() => handleDownloadPdf(inv)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 transition-colors"
                    data-testid="download-pdf-btn"
                  >
                    <Download size={12} />
                    Download PDF
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
