'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token provided.');
      return;
    }

    api
      .post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch((err: any) => {
        setStatus('error');
        setErrorMsg(err.message || 'Verification failed. The link may have expired.');
      });
  }, [token]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#FCFCFD' }}
    >
      <div className="bg-white p-8 rounded-3xl shadow-soft w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-2">
              Verifying your email...
            </h1>
            <p className="text-slate-500">Please wait a moment.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-sage-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-sage-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-2">
              Email verified!
            </h1>
            <p className="text-slate-500 mb-6">
              Your email has been successfully verified. You can now use all features.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-slate-900 text-white py-2 px-6 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Go to Dashboard
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-2">
              Verification failed
            </h1>
            <p className="text-slate-500 mb-4">{errorMsg}</p>
            <Link href="/dashboard" className="text-sage-600 hover:underline text-sm">
              Return to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: '#FCFCFD' }}
        >
          <p className="text-slate-400">Loading...</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
