'use client';

import { AlertTriangle, Clock, ShieldX, AlertCircle, RefreshCw } from 'lucide-react';

type ErrorVariant = 'expired' | 'used' | 'invalid' | 'policy' | 'generic';

interface SelfServeErrorProps {
  title: string;
  message: string;
  businessName?: string;
  businessSlug?: string;
  variant?: ErrorVariant;
}

const VARIANT_CONFIG: Record<ErrorVariant, { icon: typeof AlertTriangle; color: string }> = {
  expired: { icon: Clock, color: 'text-amber-500' },
  used: { icon: RefreshCw, color: 'text-slate-400' },
  invalid: { icon: AlertCircle, color: 'text-red-400' },
  policy: { icon: ShieldX, color: 'text-orange-400' },
  generic: { icon: AlertTriangle, color: 'text-orange-400' },
};

function detectVariant(message: string): ErrorVariant {
  const lower = message.toLowerCase();
  if (lower.includes('expired') || lower.includes('expir')) return 'expired';
  if (lower.includes('already been used') || lower.includes('already used')) return 'used';
  if (lower.includes('invalid') || lower.includes('not found')) return 'invalid';
  if (
    lower.includes('cannot be') ||
    lower.includes('policy') ||
    lower.includes('not allowed') ||
    lower.includes('within')
  )
    return 'policy';
  return 'generic';
}

export function SelfServeError({
  title,
  message,
  businessName,
  businessSlug,
  variant,
}: SelfServeErrorProps) {
  const detected = variant || detectVariant(message);
  const config = VARIANT_CONFIG[detected];
  const Icon = config.icon;

  return (
    <div
      className="min-h-screen bg-[#FCFCFD] flex items-center justify-center p-4"
      data-testid="self-serve-error"
    >
      <div className="bg-white rounded-2xl shadow-soft p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
          <Icon size={32} className={config.color} data-testid="error-icon" />
        </div>
        {businessName && (
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">{businessName}</p>
        )}
        <h1
          className="text-xl font-serif font-semibold text-slate-900 mb-2"
          data-testid="error-title"
        >
          {title}
        </h1>
        <p className="text-sm text-slate-500 mb-6" data-testid="error-message">
          {message}
        </p>

        <div className="space-y-3">
          {detected === 'expired' && (
            <p className="text-xs text-slate-400">
              This link has expired. Please contact {businessName || 'the business'} to request a
              new one.
            </p>
          )}
          {detected === 'used' && (
            <p className="text-xs text-slate-400">
              This link has already been used and cannot be reused.
            </p>
          )}
          {detected === 'policy' && (
            <p className="text-xs text-slate-400">
              This action is restricted by the business policy. Contact{' '}
              {businessName || 'the business'} for assistance.
            </p>
          )}
          {(detected === 'invalid' || detected === 'generic') && (
            <p className="text-xs text-slate-400">
              Please contact {businessName || 'the business'} directly for assistance.
            </p>
          )}

          {businessSlug && (
            <a
              href={`/book/${businessSlug}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 transition-colors"
              data-testid="book-again-link"
            >
              Book Again
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export { detectVariant };
