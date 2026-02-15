'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function SignupPage() {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ accessToken: string; staff: any }>('/auth/signup', {
        businessName,
        ownerName,
        email,
        password,
      });
      api.setToken(res.accessToken);
      router.push('/setup');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FCFCFD' }}>
      <div className="bg-white p-8 rounded-3xl shadow-soft w-full max-w-md">
        <h1 className="text-2xl font-serif font-semibold text-slate-900 text-center mb-2">Create your account</h1>
        <p className="text-slate-500 text-center mb-6">Set up your business on Booking OS</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Business name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              placeholder="Glow Clinic"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Your name</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              placeholder="Sarah Johnson"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
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
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="text-sm text-center mt-4 text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-sage-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
