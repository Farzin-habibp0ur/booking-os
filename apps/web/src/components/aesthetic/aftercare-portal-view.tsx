'use client';

import { CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import { aftercareBadgeClasses, AFTERCARE_STATUS_STYLES } from '@/lib/design-tokens';

interface Message {
  id: string;
  stepId: string;
  scheduledFor: string;
  sentAt?: string | null;
  status: string;
}

interface Step {
  id: string;
  sequenceOrder: number;
  delayHours: number;
  body: string;
  subject?: string;
}

interface Enrollment {
  id: string;
  status: string;
  enrolledAt: string;
  completedAt?: string | null;
  protocol: {
    name: string;
    steps: Step[];
  };
  booking: {
    startTime: string;
    service: { name: string };
  };
  messages: Message[];
}

interface Props {
  enrollments: Enrollment[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelative(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / 3600000);

  if (diffHours < 0) {
    const absDays = Math.floor(Math.abs(diffHours) / 24);
    if (absDays === 0) return 'Today';
    return `${absDays} day${absDays > 1 ? 's' : ''} ago`;
  }
  if (diffHours < 24) return `In ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
  const days = Math.floor(diffHours / 24);
  return `In ${days} day${days > 1 ? 's' : ''}`;
}

export function AftercarePortalView({ enrollments }: Props) {
  if (enrollments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4" data-testid="aftercare-portal-view">
      {enrollments.map((enrollment) => {
        const sentCount = enrollment.messages.filter((m) => m.status === 'SENT').length;
        const totalCount = enrollment.messages.length;

        return (
          <div key={enrollment.id} className="bg-white rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sage-600" />
                <h4 className="font-semibold text-slate-800">{enrollment.protocol.name}</h4>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${aftercareBadgeClasses(enrollment.status)}`}
              >
                {AFTERCARE_STATUS_STYLES[enrollment.status]?.label || enrollment.status}
              </span>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              For your{' '}
              <span className="font-medium text-slate-700">{enrollment.booking.service.name}</span>{' '}
              on {formatDate(enrollment.booking.startTime)}
            </p>

            {/* Steps timeline */}
            <div className="relative pl-6">
              <div className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-200" />

              {enrollment.messages.map((msg, idx) => {
                const step = enrollment.protocol.steps.find((s) => s.id === msg.stepId);
                const isSent = msg.status === 'SENT';
                const isCurrent = !isSent && idx === sentCount;

                return (
                  <div
                    key={msg.id}
                    className={`relative pb-4 last:pb-0 ${isSent ? 'opacity-70' : ''}`}
                  >
                    <div
                      className={`absolute -left-3.5 w-5 h-5 rounded-full flex items-center justify-center ${
                        isSent
                          ? 'bg-sage-100'
                          : isCurrent
                            ? 'bg-lavender-100 ring-2 ring-lavender-200'
                            : 'bg-slate-100'
                      }`}
                    >
                      {isSent ? (
                        <CheckCircle2 className="w-3 h-3 text-sage-600" />
                      ) : (
                        <Clock className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">
                          {step?.subject || `Step ${idx + 1}`}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-lavender-50 text-lavender-700 px-1.5 py-0.5 rounded-full">
                            Next
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isSent
                          ? `Sent ${formatRelative(msg.sentAt!)}`
                          : formatRelative(msg.scheduledFor)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress */}
            <div className="mt-4 pt-3 border-t border-slate-50">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {sentCount} of {totalCount} messages sent
                </span>
                <span>
                  {totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0}% complete
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                <div
                  className="bg-sage-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${totalCount > 0 ? (sentCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
