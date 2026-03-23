'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  Filter,
  Play,
  CheckCircle,
  ShieldCheck,
  Info,
} from 'lucide-react';

const TRIGGERS = [
  {
    value: 'BOOKING_CREATED',
    label: 'Booking Created',
    description: 'Fires when a new booking is created',
    example: 'A customer books a Hydra Facial for next Tuesday → this rule fires immediately.',
  },
  {
    value: 'BOOKING_UPCOMING',
    label: 'Booking Upcoming',
    description: 'Fires before an upcoming appointment',
    example:
      'A customer has an appointment tomorrow at 2 PM → this rule fires 24 hours before (today at 2 PM).',
  },
  {
    value: 'STATUS_CHANGED',
    label: 'Status Changed',
    description: 'Fires when a booking status changes',
    example:
      'A booking is marked as Completed after the appointment → this rule fires on the status change.',
  },
  {
    value: 'BOOKING_CANCELLED',
    label: 'Booking Cancelled',
    description: 'Fires when a booking is cancelled',
    example:
      'A customer cancels their appointment via self-serve link → this rule fires on cancellation.',
  },
  {
    value: 'NO_RESPONSE',
    label: 'No Response',
    description: 'Fires when a customer has not responded',
    example:
      "A customer hasn't replied to a message or booked in the configured period → this rule fires.",
  },
];

const ACTION_TYPES = [
  { value: 'SEND_TEMPLATE', label: 'Send Template Message' },
  { value: 'ADD_TAG', label: 'Add Customer Tag' },
  { value: 'ASSIGN', label: 'Assign Staff' },
];

const STEPS = ['Trigger', 'Filters', 'Actions', 'Review'];
const stepIcons = [Zap, Filter, Play, CheckCircle];

/** Generate a plain-language preview of the current filter state */
function getFilterPreview(trigger: string, filters: any): string {
  const parts: string[] = [];

  if (trigger === 'BOOKING_UPCOMING' && filters.hoursBefore) {
    parts.push(`fires ${filters.hoursBefore} hours before the appointment`);
  }
  if (trigger === 'STATUS_CHANGED' && filters.newStatus) {
    const statusLabels: Record<string, string> = {
      CONFIRMED: 'Confirmed',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      NO_SHOW: 'No Show',
    };
    parts.push(
      `only when the new status is "${statusLabels[filters.newStatus] || filters.newStatus}"`,
    );
  }

  if (parts.length === 0) return 'This rule matches all events of this trigger type.';
  return 'This rule ' + parts.join(' and ') + '.';
}

/** Generate a plain-language action preview */
function getActionPreview(actions: any[]): string {
  if (!actions[0]?.type) return '';
  const action = actions[0];

  if (action.type === 'SEND_TEMPLATE') {
    return action.category
      ? `Send a "${action.category}" template message to the customer.`
      : 'Send a template message to the customer.';
  }
  if (action.type === 'ADD_TAG') {
    return action.tag
      ? `Add the "${action.tag}" tag to the customer's profile.`
      : "Add a tag to the customer's profile.";
  }
  if (action.type === 'ASSIGN') {
    return 'Assign a staff member to the booking.';
  }
  return '';
}

/** Generate the full plain-language summary */
function getPlainLanguageSummary(
  trigger: string,
  filters: any,
  actions: any[],
  quietStart: string,
  quietEnd: string,
  maxPerDay: number,
): string {
  const triggerLabel = TRIGGERS.find((t) => t.value === trigger)?.label || trigger;
  const filterDesc = getFilterPreview(trigger, filters);
  const actionDesc = getActionPreview(actions);

  return `When "${triggerLabel}" occurs, ${filterDesc.toLowerCase().replace('this rule ', '')} Then: ${actionDesc} Messages are paused during quiet hours (${quietStart}–${quietEnd}) and limited to ${maxPerDay} per customer per day.`;
}

export default function NewAutomationPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('');
  const [filters, setFilters] = useState<any>({});
  const [actions, setActions] = useState<any[]>([{ type: 'SEND_TEMPLATE', category: '' }]);
  const [quietStart, setQuietStart] = useState('21:00');
  const [quietEnd, setQuietEnd] = useState('09:00');
  const [maxPerDay, setMaxPerDay] = useState(3);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/automations/rules', {
        name,
        trigger,
        filters,
        actions,
        quietStart,
        quietEnd,
        maxPerCustomerPerDay: maxPerDay,
      });
      router.push('/automations');
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return !!trigger;
    if (step === 1) return true;
    if (step === 2) return actions.length > 0 && actions[0].type;
    if (step === 3) return !!name;
    return true;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.push('/automations')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={16} /> Back to Automations
      </button>

      <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-6">
        Create Automation Rule
      </h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = stepIcons[i];
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div className={cn('w-8 h-px', i <= step ? 'bg-sage-400' : 'bg-slate-200')} />
              )}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  i === step
                    ? 'bg-sage-100 text-sage-700'
                    : i < step
                      ? 'bg-sage-50 text-sage-600'
                      : 'bg-slate-100 text-slate-400',
                )}
              >
                <Icon size={14} />
                {s}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 0: Trigger */}
      {step === 0 && (
        <div className="space-y-2">
          {TRIGGERS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTrigger(t.value)}
              className={cn(
                'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                trigger === t.value
                  ? 'border-sage-400 bg-sage-50'
                  : 'border-slate-100 hover:bg-slate-50',
              )}
            >
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-slate-500">{t.description}</p>
              {trigger === t.value && (
                <div
                  className="mt-2 flex items-start gap-1.5 text-xs text-sage-600 bg-sage-50 rounded-lg p-2"
                  data-testid="trigger-example"
                >
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{t.example}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Step 1: Filters */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-soft p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Optional Filters</h2>

          {trigger === 'BOOKING_UPCOMING' && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Hours before appointment</label>
              <input
                type="number"
                min={1}
                max={72}
                value={filters.hoursBefore || 24}
                onChange={(e) => setFilters({ ...filters, hoursBefore: Number(e.target.value) })}
                className="w-24 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
            </div>
          )}

          {trigger === 'STATUS_CHANGED' && (
            <div>
              <label className="text-xs text-slate-500 mb-1 block">New status</label>
              <select
                value={filters.newStatus || ''}
                onChange={(e) => setFilters({ ...filters, newStatus: e.target.value })}
                className="text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2"
              >
                <option value="">Any</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No Show</option>
              </select>
            </div>
          )}

          {/* Plain-language filter preview */}
          <div
            className="bg-lavender-50 rounded-xl p-3 text-xs text-lavender-700"
            data-testid="filter-preview"
          >
            <span className="font-medium">Preview: </span>
            {getFilterPreview(trigger, filters)}
          </div>
        </div>
      )}

      {/* Step 2: Actions */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Action</h2>
            <select
              value={actions[0]?.type || ''}
              onChange={(e) => setActions([{ ...actions[0], type: e.target.value }])}
              className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 mb-3"
            >
              <option value="">Select action...</option>
              {ACTION_TYPES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>

            {actions[0]?.type === 'SEND_TEMPLATE' && (
              <input
                value={actions[0]?.category || ''}
                onChange={(e) => setActions([{ ...actions[0], category: e.target.value }])}
                placeholder="Template category (e.g. BOOKING_CONFIRMATION)"
                className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2"
              />
            )}

            {actions[0]?.type === 'ADD_TAG' && (
              <input
                value={actions[0]?.tag || ''}
                onChange={(e) => setActions([{ ...actions[0], tag: e.target.value }])}
                placeholder="Tag name"
                className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2"
              />
            )}

            {/* Action preview */}
            {actions[0]?.type && (
              <div
                className="mt-3 bg-lavender-50 rounded-xl p-3 text-xs text-lavender-700"
                data-testid="action-preview"
              >
                <span className="font-medium">Preview: </span>
                {getActionPreview(actions)}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-5 space-y-3">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Safety Controls</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Quiet hours start</label>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Quiet hours end</label>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Max messages per customer per day
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxPerDay}
                onChange={(e) => setMaxPerDay(Number(e.target.value))}
                className="w-24 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Rule Name</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Send confirmation on new booking"
              className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
            />
          </div>

          {/* Plain-language summary */}
          <div
            className="bg-lavender-50 border border-lavender-100 rounded-2xl p-4"
            data-testid="plain-language-summary"
          >
            <p className="text-xs font-medium text-lavender-700 mb-1">In plain language</p>
            <p className="text-sm text-lavender-900">
              {getPlainLanguageSummary(trigger, filters, actions, quietStart, quietEnd, maxPerDay)}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Trigger</dt>
                <dd className="font-medium">
                  {TRIGGERS.find((t) => t.value === trigger)?.label || trigger}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Action</dt>
                <dd className="font-medium">
                  {ACTION_TYPES.find((a) => a.value === actions[0]?.type)?.label || '\u2014'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Quiet hours</dt>
                <dd className="font-medium">
                  {quietStart} \u2014 {quietEnd}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Max per customer/day</dt>
                <dd className="font-medium">{maxPerDay}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Persistent safety controls bar (visible on steps 0-1) */}
      {step < 2 && (
        <div
          className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl p-2"
          data-testid="safety-bar"
        >
          <ShieldCheck size={12} />
          <span>
            Safety controls: quiet hours {quietStart}\u2013{quietEnd}, max {maxPerDay}/customer/day
          </span>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : router.push('/automations'))}
          className="flex items-center gap-1 px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          {step > 0 ? 'Back' : 'Cancel'}
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className={cn(
              'flex items-center gap-1 px-4 py-2 text-sm rounded-xl transition-colors',
              canProceed()
                ? 'bg-sage-600 text-white hover:bg-sage-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            Next <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={!canProceed() || saving}
            className={cn(
              'px-4 py-2 text-sm rounded-xl transition-colors',
              canProceed() && !saving
                ? 'bg-sage-600 text-white hover:bg-sage-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            {saving ? 'Creating...' : 'Create Rule'}
          </button>
        )}
      </div>
    </div>
  );
}
