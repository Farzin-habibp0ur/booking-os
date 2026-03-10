'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { FormSkeleton } from '@/components/skeleton';
import { Shield, ArrowLeft, Download, Loader2, Check, AlertTriangle } from 'lucide-react';

interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

type Step = 'idle' | 'setup' | 'verify' | 'backup' | 'disable';

export default function SecuritySettingsPage() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const s = await api.get<TwoFactorStatus>('/auth/2fa/status');
      setStatus(s);
    } catch {
      // Not fatal
    }
    setLoading(false);
  };

  const handleSetup = async () => {
    setError('');
    setSubmitting(true);
    try {
      const result = await api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup');
      setSecret(result.secret);
      setOtpauthUrl(result.otpauthUrl);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to start 2FA setup');
    }
    setSubmitting(false);
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await api.post<{ backupCodes: string[] }>('/auth/2fa/verify-setup', { code });
      setBackupCodes(result.backupCodes);
      setStep('backup');
      setCode('');
      setStatus({ enabled: true, backupCodesRemaining: result.backupCodes.length });
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    }
    setSubmitting(false);
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/auth/2fa/disable', { code });
      setStatus({ enabled: false, backupCodesRemaining: 0 });
      setStep('idle');
      setCode('');
      setSecret('');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
    }
    setSubmitting(false);
  };

  const downloadBackupCodes = () => {
    const content = [
      'Booking OS - Two-Factor Authentication Backup Codes',
      '='.repeat(50),
      '',
      'Keep these codes safe. Each code can only be used once.',
      '',
      ...backupCodes.map((c, i) => `${i + 1}. ${c}`),
      '',
      `Generated: ${new Date().toISOString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booking-os-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-sage-600 hover:text-sage-700 mb-3 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Settings
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <Shield size={24} className="text-sage-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Security</h1>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-2xl shadow-soft p-6" data-testid="2fa-section">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-900">Two-Factor Authentication</h2>
          {status?.enabled && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-sage-50 text-sage-700">
              <Check size={12} /> Enabled
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Add an extra layer of security to your account by requiring a code from your
          authenticator app when you sign in.
        </p>

        {loading && (
          <FormSkeleton rows={3} />
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>
        )}

        {/* Idle state — not enabled */}
        {!loading && step === 'idle' && !status?.enabled && (
          <button
            onClick={handleSetup}
            disabled={submitting}
            className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            data-testid="enable-2fa-btn"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Enable Two-Factor Authentication
          </button>
        )}

        {/* Idle state — enabled */}
        {!loading && step === 'idle' && status?.enabled && (
          <div className="space-y-4">
            {status.backupCodesRemaining <= 2 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  You only have {status.backupCodesRemaining} backup code{status.backupCodesRemaining !== 1 ? 's' : ''} remaining.
                  Consider disabling and re-enabling 2FA to generate new codes.
                </p>
              </div>
            )}
            <p className="text-sm text-slate-500">
              {status.backupCodesRemaining} backup codes remaining
            </p>
            <button
              onClick={() => {
                setStep('disable');
                setError('');
                setCode('');
              }}
              className="border border-red-200 text-red-600 px-4 py-2 rounded-xl text-sm hover:bg-red-50 transition-colors"
              data-testid="disable-2fa-btn"
            >
              Disable Two-Factor Authentication
            </button>
          </div>
        )}

        {/* Step: verify setup — enter code from authenticator */}
        {step === 'verify' && (
          <div className="space-y-4" data-testid="2fa-setup-step">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-700 mb-2">
                Scan this URL with your authenticator app, or enter the secret key manually:
              </p>
              <div className="bg-white rounded-lg p-3 border border-slate-200 mb-3">
                <p className="text-xs text-slate-400 mb-1">Secret Key</p>
                <p
                  className="font-mono text-sm text-slate-900 break-all select-all"
                  data-testid="2fa-secret"
                >
                  {secret}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-400 mb-1">OTPAuth URL</p>
                <p className="font-mono text-xs text-slate-600 break-all select-all">
                  {otpauthUrl}
                </p>
              </div>
            </div>
            <form onSubmit={handleVerifySetup}>
              <label className="block text-sm font-medium mb-1">
                Enter the 6-digit code from your authenticator app
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-sage-500 mb-3"
                placeholder="000000"
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
                data-testid="2fa-verify-input"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting || code.length !== 6}
                  className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  data-testid="2fa-verify-btn"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Verify & Enable
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('idle');
                    setCode('');
                    setError('');
                  }}
                  className="text-sm text-slate-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: show backup codes */}
        {step === 'backup' && (
          <div className="space-y-4" data-testid="2fa-backup-step">
            <div className="bg-sage-50 border border-sage-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check size={16} className="text-sage-600" />
                <p className="font-medium text-sage-800">Two-factor authentication enabled</p>
              </div>
              <p className="text-sm text-sage-700">
                Save these backup codes in a safe place. Each code can only be used once to sign
                in if you lose access to your authenticator app.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((bc, i) => (
                <div
                  key={i}
                  className="font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-center select-all"
                  data-testid="backup-code"
                >
                  {bc}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={downloadBackupCodes}
                className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors flex items-center gap-2"
                data-testid="download-backup-btn"
              >
                <Download size={14} /> Download Codes
              </button>
              <button
                onClick={() => {
                  setStep('idle');
                  setBackupCodes([]);
                }}
                className="text-sm text-slate-500 hover:underline"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Step: disable — confirm with TOTP code */}
        {step === 'disable' && (
          <form onSubmit={handleDisable} className="space-y-4" data-testid="2fa-disable-step">
            <p className="text-sm text-slate-500">
              Enter a code from your authenticator app to disable two-factor authentication.
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-sage-500"
              placeholder="000000"
              maxLength={6}
              autoFocus
              autoComplete="one-time-code"
              data-testid="2fa-disable-input"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting || code.length < 6}
                className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                data-testid="2fa-disable-confirm-btn"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Disable 2FA
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('idle');
                  setCode('');
                  setError('');
                }}
                className="text-sm text-slate-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
