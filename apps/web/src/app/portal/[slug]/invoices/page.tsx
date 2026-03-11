'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, DollarSign, Clock } from 'lucide-react';
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

interface PortalInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  total: number;
  paidAmount: number;
  dueDate: string;
  createdAt: string;
  lineItems: Array<{ description: string; quantity: number; total: number }>;
}

export default function PortalInvoicesPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);

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

  const outstanding = invoices.filter((inv) =>
    ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status),
  );
  const outstandingTotal = outstanding.reduce(
    (sum, inv) => sum + Number(inv.total) - Number(inv.paidAmount),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/portal/${slug}/dashboard`)}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h1 className="text-2xl font-serif font-semibold text-slate-900">My Invoices</h1>
      </div>

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
          invoices.map((inv) => (
            <div key={inv.id} className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{inv.invoiceNumber}</p>
                  <div className="mt-1 space-y-0.5">
                    {inv.lineItems.slice(0, 2).map((li, i) => (
                      <p key={i} className="text-xs text-slate-500">{li.description}</p>
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
