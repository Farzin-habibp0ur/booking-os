'use client';

import { cn } from '@/lib/cn';

interface HumanTakeoverBannerProps {
  conversationId: string;
  reason?: string;
  onResolve?: (conversationId: string) => void;
}

export function HumanTakeoverBanner({
  conversationId,
  reason,
  onResolve,
}: HumanTakeoverBannerProps) {
  return (
    <div
      data-testid={`takeover-banner-${conversationId}`}
      className={cn(
        'rounded-xl border-2 border-red-300 bg-red-50 p-4 my-2',
        'flex items-center justify-between gap-3',
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-red-600 text-sm font-bold" data-testid="takeover-icon">
            !
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold text-red-800">Human Takeover Active</p>
          <p className="text-xs text-red-600">
            AI responses are paused.{reason ? ` Reason: ${reason}` : ''}
          </p>
        </div>
      </div>

      {onResolve && (
        <button
          data-testid={`takeover-resolve-${conversationId}`}
          onClick={() => onResolve(conversationId)}
          className="text-xs px-3 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition-colors flex-shrink-0"
        >
          Resume AI
        </button>
      )}
    </div>
  );
}
