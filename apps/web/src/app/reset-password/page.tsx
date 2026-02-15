'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FCFCFD' }}>
        <div className="bg-white p-8 rounded-3xl shadow-soft w-full max-w-md text-center">
          <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-2">Invalid link</h1>
          <p className="text-slate-500 mb-4">This password reset link is invalid or has expired.</p>
          <Link href="/forgot-password" className="text-sage-600 hover:underline text-sm">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      router.push('/login?reset=success');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FCFCFD' }}>
      <div className="bg-white p-8 rounded-3xl shadow-soft w-full max-w-md">
        <h1 className="text-2xl font-serif font-semibold text-slate-900 text-center mb-2">Set new password</h1>
        <p className="text-slate-500 text-center mb-6">Enter your new password below.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              minLength={8}
              placeholder="Minimum 8 characters"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              minLength={8}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FCFCFD' }}><p className="text-slate-400">Loading...</p></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
