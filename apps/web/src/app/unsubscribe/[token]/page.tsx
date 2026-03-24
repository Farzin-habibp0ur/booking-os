'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/unsubscribe/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invalid link');
        return res.json();
      })
      .then((d) => {
        setData(d);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFCFD] px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-soft p-8 text-center">
        {status === 'loading' && (
          <div className="animate-pulse space-y-4">
            <div className="h-12 w-12 bg-slate-200 rounded-full mx-auto" />
            <div className="h-4 bg-slate-200 rounded w-48 mx-auto" />
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-sage-600" />
            </div>
            <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
              Unsubscribed
            </h1>
            <p className="text-sm text-slate-500 mb-4">
              You have been unsubscribed from{' '}
              <span className="font-medium text-slate-700">
                {data?.campaignName || 'future campaigns'}
              </span>
              {data?.businessName && (
                <>
                  {' '}by <span className="font-medium text-slate-700">{data.businessName}</span>
                </>
              )}
              .
            </p>
            <p className="text-xs text-slate-400">
              You will no longer receive messages from this campaign.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <h1 className="text-xl font-serif font-semibold text-slate-900 mb-2">
              Invalid Link
            </h1>
            <p className="text-sm text-slate-500">
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
