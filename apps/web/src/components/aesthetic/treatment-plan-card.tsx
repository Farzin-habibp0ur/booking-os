'use client';

import { Clock, CheckCircle2, AlertCircle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/cn';
import { TREATMENT_PLAN_STATUS_STYLES, treatmentPlanBadgeClasses } from '@/lib/design-tokens';

interface Session {
  id: string;
  sequenceOrder: number;
  status: string;
  service: { name: string; price?: number };
  scheduledDate?: string;
  booking?: { id: string; status: string; startTime: string } | null;
}

interface TreatmentPlanCardProps {
  plan: {
    id: string;
    status: string;
    diagnosis?: string;
    goals?: string;
    totalEstimate?: number | string;
    currency?: string;
    createdAt: string;
    proposedAt?: string;
    acceptedAt?: string;
    sessions: Session[];
    customer?: { name: string };
    createdBy?: { name: string };
  };
  onAccept?: () => void;
  onDecline?: () => void;
  onClick?: () => void;
  isPortal?: boolean;
  loading?: boolean;
}

export function TreatmentPlanCard({
  plan,
  onAccept,
  onDecline,
  onClick,
  isPortal,
  loading,
}: TreatmentPlanCardProps) {
  const completedSessions = plan.sessions.filter(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED',
  ).length;
  const totalSessions = plan.sessions.length;
  const progress = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  const statusStyle = TREATMENT_PLAN_STATUS_STYLES[plan.status];
  const estimate = plan.totalEstimate ? Number(plan.totalEstimate) : 0;

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-soft p-5 transition-colors',
        onClick && 'cursor-pointer hover:bg-slate-50',
      )}
      onClick={onClick}
      data-testid="treatment-plan-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          {plan.customer && <p className="text-xs text-slate-500 mb-0.5">{plan.customer.name}</p>}
          <p className="text-sm font-medium text-slate-900">
            Treatment Plan
            {plan.createdBy && (
              <span className="text-slate-400 font-normal"> by {plan.createdBy.name}</span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Created{' '}
            {new Date(plan.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <span
          className={cn(
            'text-xs px-2.5 py-1 rounded-full font-medium',
            treatmentPlanBadgeClasses(plan.status),
          )}
        >
          {statusStyle?.label || plan.status}
        </span>
      </div>

      {/* Diagnosis summary */}
      {plan.diagnosis && (
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{plan.diagnosis}</p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Session Progress</span>
          <span>
            {completedSessions} of {totalSessions} complete
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sage-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>
            {totalSessions} session{totalSessions !== 1 ? 's' : ''}
          </span>
        </div>
        {estimate > 0 && (
          <div className="flex items-center gap-1">
            <DollarSign size={12} />
            <span>${estimate.toFixed(2)}</span>
          </div>
        )}
        {completedSessions === totalSessions && totalSessions > 0 && (
          <div className="flex items-center gap-1 text-sage-600">
            <CheckCircle2 size={12} />
            <span>Complete</span>
          </div>
        )}
      </div>

      {/* Portal actions */}
      {isPortal && plan.status === 'PROPOSED' && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
          {onDecline && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDecline();
              }}
              disabled={loading}
              className="flex-1 px-3 py-2 text-sm border rounded-xl hover:bg-slate-50 transition-colors"
            >
              Decline
            </button>
          )}
          {onAccept && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
              disabled={loading}
              className="flex-1 px-3 py-2 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Accepting...' : 'Accept Plan'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
