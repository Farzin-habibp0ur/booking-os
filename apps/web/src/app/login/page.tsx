'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useI18n, I18nProvider } from '@/lib/i18n';
import { LanguagePicker } from '@/components/language-picker';

export default function LoginPageWrapper() {
  return (
    <I18nProvider>
      <Suspense fallback={null}>
        <LoginPage />
      </Suspense>
    </I18nProvider>
  );
}

function LoginPage() {
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'success';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      sessionStorage.setItem('booking-os-login-redirect', '1');
      // Fetch user to check role for redirect
      const { api } = await import('@/lib/api');
      try {
        const me = await api.get<{ role: string }>('/auth/me');
        if (me.role === 'SUPER_ADMIN') {
          router.push('/console');
          return;
        }
      } catch {
        // Fallback to dashboard
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || t('errors.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#FCFCFD' }}
    >
      <div className="bg-white p-8 rounded-3xl shadow-soft w-full max-w-md">
        <h1 className="text-2xl font-serif font-semibold text-slate-900 text-center mb-2">
          {t('login.title')}
        </h1>
        <p className="text-slate-500 text-center mb-6">{t('login.subtitle')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {resetSuccess && (
            <div className="bg-sage-50 text-sage-700 p-3 rounded-xl text-sm">
              {t('login.reset_success')}
            </div>
          )}
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">{t('login.email_label')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">{t('login.password_label')}</label>
              <Link href="/forgot-password" className="text-xs text-sage-600 hover:underline">
                {t('login.forgot_password')}
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? t('login.signing_in') : t('login.sign_in')}
          </button>
        </form>
        <p className="text-sm text-center mt-4 text-slate-500">
          {t('login.no_account')}{' '}
          <Link href="/signup" className="text-sage-600 hover:underline">
            {t('login.sign_up')}
          </Link>
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-slate-400 text-center mt-4">{t('login.dev_hint')}</p>
        )}
        <div className="flex justify-center mt-4">
          <LanguagePicker />
        </div>
      </div>
    </div>
  );
}
