'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Clock,
  Users,
  MessageSquare,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';

interface PlaybookStats {
  sent: number;
  skipped: number;
  failed: number;
  total: number;
  lastRun: string | null;
}

/** Rich content for each built-in playbook */
const PLAYBOOK_DETAILS: Record<
  string,
  {
    whatItDoes: string;
    whenItRuns: string;
    whoItAffects: string;
    examples: string[];
    sampleMessage: string;
    borderColor: string;
  }
> = {
  'no-show-prevention': {
    whatItDoes: 'Sends a confirmation reminder 24 hours before the appointment.',
    whenItRuns: 'Triggered automatically for every upcoming booking.',
    whoItAffects: 'All customers with a confirmed booking.',
    examples: [
      'Customer booked for tomorrow at 2 PM → reminder sent today at 2 PM',
      'Customer booked for next week → reminder sent the day before',
    ],
    sampleMessage:
      'Hi {name}, just a reminder about your {service} appointment tomorrow at {time}. Reply YES to confirm or call us to reschedule.',
    borderColor: 'border-l-sage-500',
  },
  'consult-conversion': {
    whatItDoes:
      'Follows up 3 days after a completed consultation to encourage booking the full treatment.',
    whenItRuns: 'Triggered when a consultation appointment is marked as completed.',
    whoItAffects: 'Customers who completed a consultation-type service.',
    examples: [
      'Customer completes skin consultation → follow-up sent 72 hours later',
      'Customer completes hair assessment → receives treatment options',
    ],
    sampleMessage:
      'Hi {name}, thanks for your consultation with us! Ready to take the next step? Book your treatment today and get 10% off.',
    borderColor: 'border-l-lavender-500',
  },
  're-engagement': {
    whatItDoes: "Reaches out to customers who haven't booked in 30+ days.",
    whenItRuns: 'Checks daily for customers with no recent booking activity.',
    whoItAffects: 'Inactive customers with no booking in the last 30 days.',
    examples: [
      'Customer last visited Jan 15 → re-engagement sent on Feb 14',
      'Regular monthly client misses their usual booking → gentle nudge sent',
    ],
    sampleMessage:
      "Hi {name}, we haven't seen you in a while! We'd love to have you back. Book your next appointment and enjoy a returning client offer.",
    borderColor: 'border-l-amber-500',
  },
};

interface PlaybookCardProps {
  playbook: {
    id: string;
    name: string;
    description: string;
    playbook: string;
    isActive: boolean;
    installed?: boolean;
    trigger: string;
    filters: Record<string, unknown>;
    actions: any[];
  };
  onToggle: (playbookId: string) => void;
}

export function PlaybookCard({ playbook: pb, onToggle }: PlaybookCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<PlaybookStats | null>(null);

  const details = PLAYBOOK_DETAILS[pb.playbook];

  useEffect(() => {
    if (pb.installed) {
      api
        .get<PlaybookStats>(`/automations/playbooks/${pb.playbook}/stats`)
        .then(setStats)
        .catch(() => {});
    }
  }, [pb.playbook, pb.installed]);

  return (
    <div
      className={cn(
        'bg-white rounded-2xl shadow-soft overflow-hidden border-l-4 transition-shadow hover:shadow-md',
        details?.borderColor || 'border-l-slate-300',
      )}
      data-testid={`playbook-card-${pb.playbook}`}
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">{pb.name}</h3>
          </div>
          <span
            className={cn(
              'text-xs px-2 py-0.5 rounded-full',
              pb.isActive ? 'bg-sage-50 text-sage-700' : 'bg-slate-100 text-slate-500',
            )}
          >
            {pb.isActive ? 'Active' : 'Off'}
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-3">{pb.description}</p>

        {/* Stats row */}
        {stats && stats.total > 0 && (
          <div className="flex items-center gap-3 mb-3 text-xs" data-testid="playbook-stats">
            <span className="text-sage-600 font-medium">{stats.sent} sent</span>
            {stats.skipped > 0 && <span className="text-amber-600">{stats.skipped} skipped</span>}
            {stats.failed > 0 && <span className="text-red-500">{stats.failed} failed</span>}
            <span className="text-slate-400">this week</span>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(pb.playbook)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-colors',
              pb.isActive
                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                : 'bg-sage-600 text-white hover:bg-sage-700',
            )}
          >
            {pb.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {pb.isActive ? 'Disable' : 'Enable'}
          </button>
          {details && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5"
              data-testid="expand-button"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Less' : 'Details'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable details */}
      {expanded && details && (
        <div
          className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50/50"
          data-testid="playbook-details"
        >
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <MessageSquare size={12} /> What it does
            </div>
            <p className="text-xs text-slate-500">{details.whatItDoes}</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <Clock size={12} /> When it runs
            </div>
            <p className="text-xs text-slate-500">{details.whenItRuns}</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <Users size={12} /> Who it affects
            </div>
            <p className="text-xs text-slate-500">{details.whoItAffects}</p>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Examples</div>
            <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
              {details.examples.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Sample message</div>
            <div className="bg-white rounded-xl p-3 text-xs text-slate-600 border border-slate-200 italic">
              {details.sampleMessage}
            </div>
          </div>

          {/* Safety controls summary */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
              <ShieldCheck size={12} /> Safety controls
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                Max 3/customer/day
              </span>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                Global cap: 10/day
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
