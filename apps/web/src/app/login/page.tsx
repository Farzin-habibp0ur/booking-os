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
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || t('errors.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-sm border w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">{t('login.title')}</h1>
        <p className="text-gray-500 text-center mb-6">{t('login.subtitle')}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {resetSuccess && (
            <div className="bg-green-50 text-green-700 p-3 rounded text-sm">
              {t('login.reset_success')}
            </div>
          )}
          {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">{t('login.email_label')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">{t('login.password_label')}</label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                {t('login.forgot_password')}
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('login.signing_in') : t('login.sign_in')}
          </button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500">
          {t('login.no_account')}{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            {t('login.sign_up')}
          </Link>
        </p>
        {process.env.NODE_ENV === 'development' && (
          <p className="text-xs text-gray-400 text-center mt-4">{t('login.dev_hint')}</p>
        )}
        <div className="flex justify-center mt-4">
          <LanguagePicker />
        </div>
      </div>
    </div>
  );
}
