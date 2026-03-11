'use client';

import { CheckCircle2, Clock, XCircle, MessageSquare, Send } from 'lucide-react';
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
  channel: string;
  subject?: string;
  body: string;
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
  enrollment: Enrollment;
  onCancel?: (enrollmentId: string) => void;
  compact?: boolean;
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'SENT':
      return <CheckCircle2 className="w-4 h-4 text-sage-600" />;
    case 'FAILED':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'CANCELLED':
      return <XCircle className="w-4 h-4 text-slate-400" />;
    default:
      return <Clock className="w-4 h-4 text-lavender-600" />;
  }
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AftercareEnrollmentCard({ enrollment, onCancel, compact }: Props) {
  const sentCount = enrollment.messages.filter((m) => m.status === 'SENT').length;
  const totalCount = enrollment.messages.length;
  const progress = totalCount > 0 ? (sentCount / totalCount) * 100 : 0;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft" data-testid="aftercare-enrollment-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-sage-600" />
            <h4 className="text-sm font-semibold text-slate-800">{enrollment.protocol.name}</h4>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {enrollment.booking.service.name} &middot; {formatDate(enrollment.booking.startTime)}
          </p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${aftercareBadgeClasses(enrollment.status)}`}>
          {AFTERCARE_STATUS_STYLES[enrollment.status]?.label || enrollment.status}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>{sentCount} of {totalCount} messages sent</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div
            className="bg-sage-500 h-1.5 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Message timeline */}
      {!compact && (
        <div className="space-y-2 mt-4">
          {enrollment.messages.map((msg, idx) => {
            const step = enrollment.protocol.steps.find((s) => s.id === msg.stepId);
            return (
              <div key={msg.id} className="flex items-start gap-2.5" data-testid={`aftercare-message-${idx}`}>
                <div className="mt-0.5">{statusIcon(msg.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">
                      {step?.subject || `Step ${idx + 1}`}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${aftercareBadgeClasses(msg.status)}`}>
                      {msg.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {msg.sentAt ? `Sent ${formatDateTime(msg.sentAt)}` : `Scheduled ${formatDateTime(msg.scheduledFor)}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel action */}
      {enrollment.status === 'ACTIVE' && onCancel && (
        <div className="mt-3 pt-3 border-t border-slate-50">
          <button
            onClick={() => onCancel(enrollment.id)}
            className="text-xs text-red-500 hover:text-red-700 font-medium"
          >
            Cancel Aftercare
          </button>
        </div>
      )}
    </div>
  );
}
