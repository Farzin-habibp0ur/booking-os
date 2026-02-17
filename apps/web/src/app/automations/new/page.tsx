'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ArrowLeft, ArrowRight, Zap, Filter, Play, CheckCircle } from 'lucide-react';

const TRIGGERS = [
  { value: 'BOOKING_CREATED', label: 'Booking Created', description: 'Fires when a new booking is created' },
  { value: 'BOOKING_UPCOMING', label: 'Booking Upcoming', description: 'Fires before an upcoming appointment' },
  { value: 'STATUS_CHANGED', label: 'Status Changed', description: 'Fires when a booking status changes' },
  { value: 'BOOKING_CANCELLED', label: 'Booking Cancelled', description: 'Fires when a booking is cancelled' },
  { value: 'NO_RESPONSE', label: 'No Response', description: 'Fires when a customer has not responded' },
];

const ACTION_TYPES = [
  { value: 'SEND_TEMPLATE', label: 'Send Template Message' },
  { value: 'ADD_TAG', label: 'Add Customer Tag' },
  { value: 'ASSIGN', label: 'Assign Staff' },
];

const STEPS = ['Trigger', 'Filters', 'Actions', 'Review'];
const stepIcons = [Zap, Filter, Play, CheckCircle];

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
      <button onClick={() => router.push('/automations')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={16} /> Back to Automations
      </button>

      <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-6">Create Automation Rule</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = stepIcons[i];
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={cn('w-8 h-px', i <= step ? 'bg-sage-400' : 'bg-slate-200')} />}
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                i === step ? 'bg-sage-100 text-sage-700' : i < step ? 'bg-sage-50 text-sage-600' : 'bg-slate-100 text-slate-400',
              )}>
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
                trigger === t.value ? 'border-sage-400 bg-sage-50' : 'border-slate-100 hover:bg-slate-50',
              )}
            >
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-xs text-slate-500">{t.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 1: Filters */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-soft p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Optional Filters</h2>

          {(trigger === 'BOOKING_UPCOMING') && (
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

          {(trigger === 'STATUS_CHANGED') && (
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

          <p className="text-xs text-slate-400">Leave empty to match all events of this trigger type.</p>
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
                <option key={a.value} value={a.value}>{a.label}</option>
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
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Safety Controls</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Quiet hours start</label>
                <input type="time" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Quiet hours end</label>
                <input type="time" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Max messages per customer per day</label>
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

          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Trigger</dt>
                <dd className="font-medium">{TRIGGERS.find((t) => t.value === trigger)?.label || trigger}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Action</dt>
                <dd className="font-medium">{ACTION_TYPES.find((a) => a.value === actions[0]?.type)?.label || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Quiet hours</dt>
                <dd className="font-medium">{quietStart} — {quietEnd}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Max per customer/day</dt>
                <dd className="font-medium">{maxPerDay}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : router.push('/automations')}
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
              canProceed() ? 'bg-sage-600 text-white hover:bg-sage-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed',
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
              canProceed() && !saving ? 'bg-sage-600 text-white hover:bg-sage-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            {saving ? 'Creating...' : 'Create Rule'}
          </button>
        )}
      </div>
    </div>
  );
}
