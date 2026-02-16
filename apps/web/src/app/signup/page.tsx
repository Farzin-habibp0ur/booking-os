'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useI18n, I18nProvider } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-picker';

export default function SignupPageWrapper() {
  return (
    <I18nProvider>
      <Suspense fallback={null}>
        <SignupPage />
      </Suspense>
    </I18nProvider>
  );
}

function SignupPage() {
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, signup } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('signup.passwords_mismatch'));
      return;
    }

    setLoading(true);
    try {
      await signup(businessName, ownerName, email, password);
      router.push('/setup');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FCFCFD' }}>
      <div className="bg-white p-8 rounded-3xl shadow-soft w-full max-w-md">
        <h1 className="text-2xl font-serif font-semibold text-slate-900 text-center mb-2">{t('signup.title')}</h1>
        <p className="text-slate-500 text-center mb-6">{t('signup.subtitle')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">{t('signup.business_name')}</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              placeholder={t('signup.business_name_placeholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('signup.your_name')}</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              placeholder={t('signup.your_name_placeholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('signup.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('signup.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              minLength={8}
              placeholder={t('signup.password_placeholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('signup.confirm_password')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              minLength={8}
              placeholder={t('signup.confirm_password_placeholder')}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? t('signup.creating') : t('signup.create_account')}
          </button>
        </form>
        <p className="text-xs text-center mt-3 text-slate-400">
          {t('signup.terms_text')}
        </p>
        <p className="text-sm text-center mt-4 text-slate-500">
          {t('signup.already_have_account')}{' '}
          <Link href="/login" className="text-sage-600 hover:underline">
            {t('signup.sign_in')}
          </Link>
        </p>
        <div className="flex justify-center mt-4">
          <LanguagePicker />
        </div>
      </div>
    </div>
  );
}
