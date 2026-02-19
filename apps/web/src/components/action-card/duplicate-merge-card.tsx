'use client';

import { cn } from '@/lib/cn';

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface DuplicateMergeCardProps {
  id: string;
  customer1: CustomerProfile;
  customer2: CustomerProfile;
  matchFields: string[];
  confidence: number;
  status?: string;
  onMerge?: (cardId: string, primaryId: string, secondaryId: string) => void;
  onNotDuplicate?: (cardId: string) => void;
  onDismiss?: (cardId: string) => void;
}

export function DuplicateMergeCard({
  id,
  customer1,
  customer2,
  matchFields,
  confidence,
  status = 'PENDING',
  onMerge,
  onNotDuplicate,
  onDismiss,
}: DuplicateMergeCardProps) {
  const isPending = status === 'PENDING';
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div
      data-testid={`duplicate-card-${id}`}
      className={cn(
        'rounded-xl border p-4 my-2',
        isPending ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-200 opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
          <span className="text-slate-600 text-sm font-bold" data-testid="duplicate-icon">
            ⊕
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Possible Duplicate</p>
            <span
              data-testid="confidence-badge"
              className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600"
            >
              {confidencePercent}% match
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2" data-testid="customer-comparison">
            <CustomerProfileCard customer={customer1} label="Customer A" />
            <CustomerProfileCard customer={customer2} label="Customer B" />
          </div>

          <div className="mt-2 flex flex-wrap gap-1" data-testid="match-fields">
            {matchFields.map((field) => (
              <span
                key={field}
                className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
              >
                {field}
              </span>
            ))}
          </div>

          {isPending && (onMerge || onNotDuplicate || onDismiss) && (
            <div className="mt-3 flex justify-end gap-2">
              {onDismiss && (
                <button
                  data-testid={`dismiss-${id}`}
                  onClick={() => onDismiss(id)}
                  className="text-xs px-3 py-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Dismiss
                </button>
              )}
              {onNotDuplicate && (
                <button
                  data-testid={`not-duplicate-${id}`}
                  onClick={() => onNotDuplicate(id)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Not Duplicate
                </button>
              )}
              {onMerge && (
                <button
                  data-testid={`merge-${id}`}
                  onClick={() => onMerge(id, customer1.id, customer2.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-sage-600 text-white hover:bg-sage-700 transition-colors"
                >
                  Merge
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerProfileCard({ customer, label }: { customer: CustomerProfile; label: string }) {
  return (
    <div className="bg-white rounded-lg p-2 border border-slate-100 text-xs">
      <p className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</p>
      <p className="font-medium text-slate-800 truncate">{customer.name}</p>
      <p className="text-slate-500 truncate">{customer.phone}</p>
      {customer.email && <p className="text-slate-500 truncate">{customer.email}</p>}
    </div>
  );
}
