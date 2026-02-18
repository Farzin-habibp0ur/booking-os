'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { X } from 'lucide-react';

const ICON_OPTIONS = ['filter', 'star', 'flag', 'bookmark', 'heart', 'eye', 'bell', 'zap'];
const COLOR_OPTIONS = [
  { key: 'sage', bg: 'bg-sage-500' },
  { key: 'lavender', bg: 'bg-lavender-500' },
  { key: 'amber', bg: 'bg-amber-500' },
  { key: 'slate', bg: 'bg-slate-500' },
];

interface SaveViewModalProps {
  page: string;
  filters: Record<string, unknown>;
  onClose: () => void;
  onSaved: (view: any) => void;
}

export function SaveViewModal({ page, filters, onClose, onSaved }: SaveViewModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const view = await api.post<any>('/saved-views', {
        page,
        name: name.trim(),
        filters,
        icon,
        color,
      });
      onSaved(view);
      onClose();
    } catch {
      // Handle error silently
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="save-view-modal">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t('saved_views.save_title')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{t('saved_views.name_label')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('saved_views.name_placeholder')}
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t('saved_views.icon_label')}</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICON_OPTIONS.map((i) => (
                <button
                  key={i}
                  onClick={() => setIcon(icon === i ? null : i)}
                  className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-colors ${
                    icon === i
                      ? 'bg-sage-100 text-sage-700 ring-2 ring-sage-500'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {i.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t('saved_views.color_label')}</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setColor(color === c.key ? null : c.key)}
                  className={`w-6 h-6 rounded-full ${c.bg} transition-all ${
                    color === c.key ? 'ring-2 ring-offset-2 ring-sage-500' : ''
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-xl transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="text-xs font-medium text-white bg-sage-600 hover:bg-sage-700 px-4 py-1.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
