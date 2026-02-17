'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { publicApi } from '@/lib/public-api';
import {
  CheckCircle,
  AlertTriangle,
  FileText,
  Wrench,
  User,
  DollarSign,
} from 'lucide-react';

interface QuoteSummary {
  quote: {
    id: string;
    description: string;
    totalAmount: number;
    pdfUrl: string | null;
    status: string;
    createdAt: string;
  };
  booking: {
    id: string;
    service: { id: string; name: string; durationMins: number };
    staff: { id: string; name: string } | null;
    customer: { name: string };
  };
  business: { id: string; name: string } | null;
}

type PageState = 'loading' | 'review' | 'submitting' | 'success' | 'error';

export default function QuoteApprovalPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<QuoteSummary | null>(null);

  useEffect(() => {
    publicApi
      .get<QuoteSummary>(`/self-serve/validate/quote/${token}`)
      .then((res) => {
        setData(res);
        setState('review');
      })
      .catch((err) => {
        setError(err.message || 'This link is invalid or has expired.');
        setState('error');
      });
  }, [token]);

  const handleApprove = async () => {
    setState('submitting');
    try {
      await publicApi.post(`/self-serve/approve-quote/${token}`, {});
      setState('success');
    } catch (err: any) {
      setError(err.message || 'Failed to approve quote. Please try again.');
      setState('error');
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center py-16">
        <AlertTriangle size={48} className="mx-auto text-orange-400 mb-4" />
        <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
          Unable to Load Quote
        </h1>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{error}</p>
        <p className="text-sm text-slate-400">
          Please contact the service provider directly for assistance.
        </p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="text-center py-16">
        <CheckCircle size={48} className="mx-auto text-sage-500 mb-4" />
        <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
          Quote Approved
        </h1>
        <p className="text-slate-500 mb-2">
          You have approved the quote for {data?.booking.service.name}.
        </p>
        <p className="text-sm text-slate-500">
          Total: {formatCurrency(data?.quote.totalAmount || 0)}
        </p>
        <p className="text-sm text-slate-400 mt-4">
          Work will begin shortly. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-semibold text-slate-900">
          Service Quote
        </h1>
        {data?.business && (
          <p className="text-sm text-slate-500 mt-1">{data.business.name}</p>
        )}
      </div>

      {/* Greeting */}
      <p className="text-sm text-slate-600">
        Hi {data?.booking.customer.name}, please review the quote below for your{' '}
        {data?.booking.service.name} appointment.
      </p>

      {/* Quote details card */}
      <div className="bg-white rounded-2xl shadow-soft p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
          <FileText size={14} />
          Quote Details
        </div>

        {/* Service + Staff */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Wrench size={14} className="text-slate-400" />
            <span>{data?.booking.service.name}</span>
          </div>
          {data?.booking.staff && (
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-slate-400" />
              <span>{data.booking.staff.name}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {data?.quote.description}
          </p>
        </div>

        {/* Total */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
              <DollarSign size={14} className="text-slate-400" />
              Total
            </span>
            <span className="text-xl font-serif font-semibold text-slate-900">
              {formatCurrency(data?.quote.totalAmount || 0)}
            </span>
          </div>
        </div>

        {/* PDF download */}
        {data?.quote.pdfUrl && (
          <a
            href={data.quote.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-sage-600 hover:text-sage-700 font-medium"
          >
            <FileText size={14} />
            Download PDF
          </a>
        )}
      </div>

      {/* Approve button */}
      <button
        onClick={handleApprove}
        disabled={state === 'submitting'}
        className="w-full py-3 bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
      >
        {state === 'submitting' ? 'Approving...' : 'Approve Quote'}
      </button>

      <p className="text-xs text-center text-slate-400">
        By approving, you authorize the service provider to proceed with the work described above.
      </p>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
