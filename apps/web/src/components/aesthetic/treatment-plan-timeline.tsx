'use client';

import { CheckCircle2, Circle, Clock, SkipForward, Calendar } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Session {
  id: string;
  sequenceOrder: number;
  status: string;
  service: { name: string; price?: number; durationMins?: number };
  scheduledDate?: string;
  completedAt?: string;
  notes?: string;
  booking?: { id: string; status: string; startTime: string } | null;
}

interface TreatmentPlanTimelineProps {
  sessions: Session[];
  onSessionClick?: (session: Session) => void;
}

const STATUS_CONFIG: Record<string, { icon: typeof Circle; color: string; lineColor: string }> = {
  COMPLETED: {
    icon: CheckCircle2,
    color: 'text-sage-600 bg-sage-50',
    lineColor: 'bg-sage-300',
  },
  SCHEDULED: {
    icon: Calendar,
    color: 'text-blue-600 bg-blue-50',
    lineColor: 'bg-blue-200',
  },
  PENDING: {
    icon: Circle,
    color: 'text-slate-400 bg-slate-100',
    lineColor: 'bg-slate-200',
  },
  SKIPPED: {
    icon: SkipForward,
    color: 'text-slate-400 bg-slate-50',
    lineColor: 'bg-slate-200',
  },
};

export function TreatmentPlanTimeline({ sessions, onSessionClick }: TreatmentPlanTimelineProps) {
  if (sessions.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No sessions in this plan.</p>;
  }

  return (
    <div className="space-y-0" data-testid="treatment-plan-timeline">
      {sessions.map((session, index) => {
        const config = STATUS_CONFIG[session.status] || STATUS_CONFIG.PENDING;
        const Icon = config.icon;
        const isLast = index === sessions.length - 1;

        return (
          <div
            key={session.id}
            className={cn('relative flex gap-4 pb-6', onSessionClick && 'cursor-pointer')}
            onClick={() => onSessionClick?.(session)}
            data-testid={`timeline-session-${session.sequenceOrder}`}
          >
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  config.color,
                )}
              >
                <Icon size={16} />
              </div>
              {!isLast && <div className={cn('w-0.5 flex-1 mt-1', config.lineColor)} />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-2 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{session.service.name}</p>
                <span className="text-xs text-slate-400">Session {session.sequenceOrder}</span>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                {session.status === 'COMPLETED' && session.completedAt && (
                  <span>
                    Completed{' '}
                    {new Date(session.completedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
                {session.status === 'SCHEDULED' && session.booking?.startTime && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(session.booking.startTime).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(session.booking.startTime).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                {session.status === 'PENDING' && session.scheduledDate && (
                  <span className="text-slate-400">
                    Target:{' '}
                    {new Date(session.scheduledDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
                {session.status === 'SKIPPED' && <span className="text-slate-400">Skipped</span>}
                {session.service.price != null && session.service.price > 0 && (
                  <span>${session.service.price}</span>
                )}
              </div>

              {session.notes && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">{session.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
