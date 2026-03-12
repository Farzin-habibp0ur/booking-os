'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';

interface MedicalAlertBannerProps {
  flagged: boolean;
  flagReason: string | null;
  allergies?: string[];
  contraindications?: string[];
  compact?: boolean;
}

export function MedicalAlertBanner({
  flagged,
  flagReason,
  allergies = [],
  contraindications = [],
  compact = false,
}: MedicalAlertBannerProps) {
  if (!flagged) return null;

  if (compact) {
    return (
      <span title={flagReason ?? 'Medical alert'}>
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-red-800">Medical Alert</h4>
          {flagReason && <p className="text-sm text-red-700">{flagReason}</p>}
          {allergies.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-700">Allergies:</p>
              <div className="flex flex-wrap gap-1">
                {allergies.map((allergy, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
                  >
                    {allergy}
                  </span>
                ))}
              </div>
            </div>
          )}
          {contraindications.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-700">Contraindications:</p>
              <div className="flex flex-wrap gap-1">
                {contraindications.map((item, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
