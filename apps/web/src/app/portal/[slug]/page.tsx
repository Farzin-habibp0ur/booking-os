'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Phone, Mail, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

type Tab = 'phone' | 'email';

export default function PortalLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('phone');
  const [business, setBusiness] = useState<any>(null);

  // Phone OTP state
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // Email state
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const [error, setError] = useState('');

  // Fetch business info
  useEffect(() => {
    fetch(`${API_URL}/public/${slug}`)
      .then((r) => r.json())
      .then(setBusiness)
      .catch(() => {});
  }, [slug]);

  // Handle magic link token from URL
  useEffect(() => {
    const magicToken = searchParams.get('magic_token');
    if (magicToken) {
      fetch(`${API_URL}/portal/auth/verify-magic-link?token=${magicToken}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.token) {
            sessionStorage.setItem('portal-token', data.token);
            router.replace(`/portal/${slug}/dashboard`);
          } else {
            setError('Invalid or expired magic link');
          }
        })
        .catch(() => setError('Failed to verify magic link'));
    }
  }, [searchParams, slug, router]);

  const handleRequestOtp = async () => {
    setError('');
    setPhoneLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send code');
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    setPhoneLoading(true);
    const code = otp.join('');
    try {
      const res = await fetch(`${API_URL}/portal/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, phone, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');
      sessionStorage.setItem('portal-token', data.token);
      router.replace(`/portal/${slug}/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleRequestMagicLink = async () => {
    setError('');
    setEmailLoading(true);
    try {
      const res = await fetch(`${API_URL}/portal/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send link');
      setEmailSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);

    // Auto-advance to next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Business branding */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-sage-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-serif font-bold text-sage-700">
              {(business?.name || slug)?.[0]?.toUpperCase()}
            </span>
          </div>
          <h1 className="text-xl font-serif font-semibold text-slate-900">
            {business?.name || 'Customer Portal'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to manage your bookings</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => {
              setTab('phone');
              setError('');
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-colors',
              tab === 'phone'
                ? 'bg-white text-slate-900 shadow-sm font-medium'
                : 'text-slate-500 hover:text-slate-700',
            )}
            data-testid="tab-phone"
          >
            <Phone size={14} /> Phone
          </button>
          <button
            onClick={() => {
              setTab('email');
              setError('');
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-colors',
              tab === 'email'
                ? 'bg-white text-slate-900 shadow-sm font-medium'
                : 'text-slate-500 hover:text-slate-700',
            )}
            data-testid="tab-email"
          >
            <Mail size={14} /> Email
          </button>
        </div>

        {error && (
          <div
            className="mb-4 bg-red-50 text-red-700 text-sm rounded-xl p-3"
            data-testid="error-message"
          >
            {error}
          </div>
        )}

        {/* Phone OTP Tab */}
        {tab === 'phone' && (
          <div data-testid="phone-tab">
            {!otpSent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                    data-testid="phone-input"
                  />
                </div>
                <button
                  onClick={handleRequestOtp}
                  disabled={!phone || phoneLoading}
                  className="w-full bg-sage-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  data-testid="send-otp-btn"
                >
                  {phoneLoading && <Loader2 size={16} className="animate-spin" />}
                  Send Code
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 text-center">
                  Enter the 6-digit code sent to <strong>{phone}</strong>
                </p>
                <div className="flex gap-2 justify-center" data-testid="otp-inputs">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      className="w-10 h-12 text-center text-lg font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                    />
                  ))}
                </div>
                <button
                  onClick={handleVerifyOtp}
                  disabled={otp.some((d) => !d) || phoneLoading}
                  className="w-full bg-sage-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  data-testid="verify-otp-btn"
                >
                  {phoneLoading && <Loader2 size={16} className="animate-spin" />}
                  Verify
                </button>
                <button
                  onClick={() => {
                    setOtpSent(false);
                    setOtp(['', '', '', '', '', '']);
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-700"
                >
                  Use a different number
                </button>
              </div>
            )}
          </div>
        )}

        {/* Email Magic Link Tab */}
        {tab === 'email' && (
          <div data-testid="email-tab">
            {!emailSent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                    data-testid="email-input"
                  />
                </div>
                <button
                  onClick={handleRequestMagicLink}
                  disabled={!email || emailLoading}
                  className="w-full bg-sage-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  data-testid="send-magic-link-btn"
                >
                  {emailLoading && <Loader2 size={16} className="animate-spin" />}
                  Send Magic Link
                </button>
              </div>
            ) : (
              <div className="text-center space-y-3" data-testid="email-sent-confirmation">
                <div className="w-12 h-12 bg-sage-100 rounded-full flex items-center justify-center mx-auto">
                  <Mail size={20} className="text-sage-600" />
                </div>
                <p className="text-sm text-slate-700 font-medium">Check your email</p>
                <p className="text-xs text-slate-500">
                  We sent a sign-in link to <strong>{email}</strong>. Click the link to access your
                  portal.
                </p>
                <button
                  onClick={() => {
                    setEmailSent(false);
                    setEmail('');
                  }}
                  className="text-sm text-sage-600 hover:text-sage-700"
                >
                  Use a different email
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
