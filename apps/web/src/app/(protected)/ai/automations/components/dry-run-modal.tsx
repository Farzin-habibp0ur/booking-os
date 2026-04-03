'use client';

import { cn } from '@/lib/cn';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface DryRunResult {
  rule: { id: string; name: string; trigger: string };
  dryRun: boolean;
  matchedCount: number;
  matchedBookings: {
    id: string;
    customerName: string;
    serviceName: string;
    startTime: string;
    status: string;
  }[];
  skipped: { bookingId: string; reason: string }[];
  message: string;
}

export function DryRunModal({ result, onClose }: { result: DryRunResult; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      data-testid="dry-run-modal"
    >
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Dry Run Results</h3>
            <p className="text-xs text-slate-500 mt-0.5">{result.rule.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={16} />
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 border-b">
          <div
            className={cn(
              'flex items-start gap-2 p-3 rounded-xl text-sm',
              result.matchedCount > 0 ? 'bg-sage-50 text-sage-800' : 'bg-slate-50 text-slate-600',
            )}
            data-testid="dry-run-summary"
          >
            {result.matchedCount > 0 ? (
              <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            )}
            <span>{result.message}</span>
          </div>
        </div>

        {/* Matched Bookings */}
        <div className="flex-1 overflow-y-auto p-4">
          {result.matchedBookings.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">
                Matched Bookings ({result.matchedCount})
              </h4>
              <div className="space-y-2">
                {result.matchedBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2.5 bg-sage-50/50 rounded-xl"
                    data-testid="matched-booking"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{b.customerName}</p>
                      <p className="text-xs text-slate-500">{b.serviceName}</p>
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        b.status === 'CONFIRMED'
                          ? 'bg-sage-50 text-sage-700'
                          : b.status === 'CANCELLED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-slate-500 uppercase mb-2">
                Skipped ({result.skipped.length})
              </h4>
              <div className="space-y-2">
                {result.skipped.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2.5 bg-amber-50/50 rounded-xl"
                    data-testid="skipped-booking"
                  >
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-xs text-amber-700">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.matchedBookings.length === 0 && result.skipped.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              No bookings matched or were skipped by this rule.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
