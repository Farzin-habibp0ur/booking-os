'use client';

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import type { PackField } from '@/lib/vertical-pack';

interface ClinicIntakeCardProps {
  customer: { id: string; customFields?: Record<string, any> };
  fields: PackField[];
  onUpdated: (updatedCustomer: any) => void;
}

export default function ClinicIntakeCard({ customer, fields, onUpdated }: ClinicIntakeCardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, any>>({});

  const customFields = customer.customFields || {};

  const filled = fields.filter((f) => {
    const v = customFields[f.key];
    return v !== undefined && v !== null && v !== '';
  }).length;
  const total = fields.length;
  const allComplete = filled === total;

  function startEditing() {
    const initial: Record<string, any> = {};
    for (const f of fields) {
      initial[f.key] = customFields[f.key] ?? (f.type === 'boolean' ? false : '');
    }
    setDraft(initial);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setDraft({});
  }

  async function save() {
    setSaving(true);
    try {
      const merged = { ...customFields, ...draft };
      const updated = await api.patch<any>(`/customers/${customer.id}`, {
        customFields: merged,
      });
      onUpdated(updated);
      toast(t('inbox.intake_saved'), 'success');
      setEditing(false);
      setDraft({});
    } catch {
      toast(t('inbox.intake_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  function renderValue(field: PackField) {
    const value = customFields[field.key];
    const isEmpty = value === undefined || value === null || value === '';

    if (isEmpty) {
      return (
        <span className="text-slate-400 italic text-xs">{t('inbox.intake_not_set')}</span>
      );
    }

    if (field.type === 'boolean') {
      return <span className="text-sm text-slate-800">{value ? t('common.yes') : t('common.no')}</span>;
    }

    return <span className="text-sm text-slate-800">{String(value)}</span>;
  }

  function renderInput(field: PackField) {
    const value = draft[field.key];

    if (field.type === 'boolean') {
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => setDraft({ ...draft, [field.key]: e.target.checked })}
          className="h-4 w-4 rounded text-sage-600 focus:ring-sage-500"
        />
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <select
          value={value || ''}
          onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
          className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm px-2 py-1.5"
        >
          <option value="">--</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
        placeholder={field.placeholder || field.label}
        className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm px-2 py-1.5"
      />
    );
  }

  return (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase">
            {t('inbox.clinic_intake')}
          </span>
          <span
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              allComplete
                ? 'bg-sage-50 text-sage-700'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            {t('inbox.intake_complete', { filled: String(filled), total: String(total) })}
          </span>
        </div>
        {!editing && (
          <button
            onClick={startEditing}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={t('inbox.intake_edit')}
          >
            <Pencil size={14} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {fields.map((field) => {
          const value = customFields[field.key];
          const isEmpty = value === undefined || value === null || value === '';

          return (
            <div key={field.key} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                {!editing && isEmpty && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                )}
                <span className="text-xs text-slate-500">{field.label}</span>
              </div>
              <div className="text-right min-w-0 flex-1">
                {editing ? renderInput(field) : renderValue(field)}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 bg-sage-600 hover:bg-sage-700 text-white px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-50 transition-colors"
          >
            <Check size={12} />
            {t('inbox.intake_save')}
          </button>
          <button
            onClick={cancelEditing}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
          >
            <X size={12} />
            {t('inbox.intake_cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
