'use client';

import { useState } from 'react';
import { Heart, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';

interface WellnessIntakeCardProps {
  customer: {
    id: string;
    customFields?: Record<string, any>;
  };
  onUpdated: (customer: any) => void;
}

const WELLNESS_FIELDS = [
  { key: 'healthGoals', label: 'Health Goals', type: 'text' as const },
  {
    key: 'fitnessLevel',
    label: 'Fitness Level',
    type: 'select' as const,
    options: ['Beginner', 'Intermediate', 'Advanced', 'Elite'],
  },
  { key: 'injuries', label: 'Injuries / Conditions', type: 'text' as const },
  { key: 'medications', label: 'Medications', type: 'text' as const },
  { key: 'allergies', label: 'Allergies', type: 'text' as const },
  {
    key: 'preferredModality',
    label: 'Preferred Modality',
    type: 'select' as const,
    options: ['Massage', 'Yoga', 'Personal Training', 'Nutrition', 'Meditation', 'No Preference'],
  },
  {
    key: 'membershipType',
    label: 'Membership',
    type: 'select' as const,
    options: ['Drop-in', 'Monthly', 'Annual', 'VIP'],
  },
] as const;

export default function WellnessIntakeCard({ customer, onUpdated }: WellnessIntakeCardProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});

  const cf = customer.customFields || {};
  const filled = WELLNESS_FIELDS.filter((f) => {
    const v = cf[f.key];
    return v !== undefined && v !== null && v !== '';
  }).length;
  const total = WELLNESS_FIELDS.length;
  const hasAlerts = !!(cf.injuries || cf.medications || cf.allergies);

  function startEditing() {
    const initial: Record<string, any> = {};
    for (const f of WELLNESS_FIELDS) {
      initial[f.key] = cf[f.key] ?? '';
    }
    setDraft(initial);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const merged = { ...cf, ...draft };
      const updated = await api.patch<any>(`/customers/${customer.id}`, { customFields: merged });
      onUpdated(updated);
      toast('Intake form saved', 'success');
      setEditing(false);
      setDraft({});
    } catch {
      toast('Failed to save intake form', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5" data-testid="wellness-intake-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sage-50 flex items-center justify-center">
            <Heart size={14} className="text-sage-600" />
          </div>
          <span className="text-sm font-semibold text-slate-800">Wellness Intake</span>
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              filled === total ? 'bg-sage-50 text-sage-700' : 'bg-amber-50 text-amber-700',
            )}
          >
            {filled}/{total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasAlerts && !editing && (
            <div className="flex items-center gap-1 text-amber-600" title="Has medical notes">
              <AlertTriangle size={14} />
            </div>
          )}
          {!editing && (
            <button
              onClick={startEditing}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Edit intake"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {WELLNESS_FIELDS.map((field) => {
          const value = cf[field.key];
          const isEmpty = value === undefined || value === null || value === '';

          return (
            <div key={field.key} className="flex items-start justify-between gap-2">
              <span className="text-xs text-slate-500 shrink-0 pt-0.5">{field.label}</span>
              <div className="text-right min-w-0 flex-1">
                {editing ? (
                  field.type === 'select' ? (
                    <select
                      value={draft[field.key] || ''}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                      className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm px-2 py-1.5"
                    >
                      <option value="">--</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={draft[field.key] || ''}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                      placeholder={field.label}
                      className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm px-2 py-1.5"
                    />
                  )
                ) : isEmpty ? (
                  <span className="text-slate-400 italic text-xs">Not set</span>
                ) : (
                  <span className="text-sm text-slate-800">{String(value)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="flex gap-2 mt-4">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 bg-sage-600 hover:bg-sage-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-50 transition-colors"
          >
            <Check size={12} />
            Save
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setDraft({});
            }}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
          >
            <X size={12} />
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
