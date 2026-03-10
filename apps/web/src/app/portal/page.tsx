'use client';

import { useState } from 'react';
import { Mail, Loader2, ArrowRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function PortalPage() {
  const [email, setEmail] = useState('');
  const [portalCode, setPortalCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: portalCode.trim().toLowerCase(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send login link');
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sage-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-serif font-bold text-sage-700">B</span>
          </div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Client Portal</h1>
          <p className="text-sm text-slate-500 mt-1">View and manage your appointments</p>
        </div>

        <div className="bg-white rounded-2xl shadow-soft p-8">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="portal-code"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Portal Code
                </label>
                <input
                  id="portal-code"
                  type="text"
                  value={portalCode}
                  onChange={(e) => setPortalCode(e.target.value)}
                  placeholder="e.g. glow-clinic"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                  data-testid="portal-code-input"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Your business provided this in your booking confirmation
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                  data-testid="email-input"
                />
              </div>

              {error && (
                <div
                  className="bg-red-50 text-red-700 text-sm rounded-xl p-3"
                  data-testid="error-message"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!email || !portalCode || loading}
                className="w-full bg-sage-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                data-testid="send-link-btn"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                Send Login Link
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4" data-testid="sent-confirmation">
              <div className="w-14 h-14 bg-sage-100 rounded-full flex items-center justify-center mx-auto">
                <Mail size={24} className="text-sage-600" />
              </div>
              <div>
                <p className="text-base font-medium text-slate-900">Check your email</p>
                <p className="text-sm text-slate-500 mt-1">
                  We sent a sign-in link to <strong>{email}</strong>. Click the link to access your
                  portal.
                </p>
              </div>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail('');
                  setError('');
                }}
                className="text-sm text-sage-600 hover:text-sage-700 font-medium"
                data-testid="try-again-btn"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by <span className="font-medium text-slate-500">Booking OS</span>
        </p>
      </div>
    </div>
  );
}
