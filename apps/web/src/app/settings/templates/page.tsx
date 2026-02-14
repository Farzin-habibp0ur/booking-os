'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, Eye, X, FileText } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

const CATEGORIES = ['CONFIRMATION', 'REMINDER', 'FOLLOW_UP', 'CANCELLATION', 'CUSTOM'];

const CATEGORY_KEYS: Record<string, string> = {
  CONFIRMATION: 'templates.category_confirmation',
  REMINDER: 'templates.category_reminder',
  FOLLOW_UP: 'templates.category_follow_up',
  CANCELLATION: 'templates.category_cancellation',
  CUSTOM: 'templates.category_custom',
};

const SAMPLE_VARS: Record<string, string> = {
  customerName: 'Jane Doe',
  serviceName: 'Botox Treatment',
  date: 'Feb 20, 2026',
  time: '10:00 AM',
  staffName: 'Dr. Sarah Chen',
  businessName: 'Glow Aesthetic Clinic',
};

export default function TemplatesPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>('ALL');

  const load = () => api.get<any[]>('/templates').then(setTemplates);

  useEffect(() => { load(); }, []);

  const filtered = filterCat === 'ALL' ? templates : templates.filter((tpl) => tpl.category === filterCat);

  const deleteTemplate = async (id: string) => {
    if (!confirm(t('templates.delete_confirm'))) return;
    await api.del(`/templates/${id}`);
    load();
  };

  const resolvePreview = (body: string) => {
    let resolved = body;
    for (const [key, value] of Object.entries(SAMPLE_VARS)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return resolved;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{t('templates.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('templates.description')}</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">
          <Plus size={16} /> {t('templates.new_template')}
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4">
        {['ALL', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm',
              filterCat === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
            )}
          >
            {cat === 'ALL' ? t('common.all') : t(CATEGORY_KEYS[cat])}
            {cat !== 'ALL' && (
              <span className="ml-1 text-xs opacity-70">({templates.filter((tpl) => tpl.category === cat).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div className="space-y-3">
        {filtered.map((tpl) => (
          <div key={tpl.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={14} className="text-gray-400" />
                  <h3 className="font-semibold text-sm">{tpl.name}</h3>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full',
                    tpl.category === 'CONFIRMATION' ? 'bg-green-100 text-green-700' :
                    tpl.category === 'REMINDER' ? 'bg-blue-100 text-blue-700' :
                    tpl.category === 'FOLLOW_UP' ? 'bg-purple-100 text-purple-700' :
                    tpl.category === 'CANCELLATION' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  )}>
                    {t(CATEGORY_KEYS[tpl.category] || 'templates.category_custom')}
                  </span>
                </div>

                {/* Template body */}
                <div className="bg-gray-50 rounded p-3 mt-2 text-sm text-gray-700 font-mono whitespace-pre-wrap">
                  {tpl.body}
                </div>

                {/* Variables */}
                {tpl.variables?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tpl.variables.map((v: string) => (
                      <span key={v} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                    ))}
                  </div>
                )}

                {/* Preview */}
                {previewId === tpl.id && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">{t('templates.preview_label')}</p>
                    <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
                      {resolvePreview(tpl.body)}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() => setPreviewId(previewId === tpl.id ? null : tpl.id)}
                  className={cn('p-1.5 rounded hover:bg-gray-100', previewId === tpl.id && 'bg-blue-50 text-blue-600')}
                  title={t('templates.preview')}
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => { setEditing(tpl); setShowForm(true); }}
                  className="p-1.5 rounded hover:bg-gray-100"
                  title={t('common.edit')}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteTemplate(tpl.id)}
                  className="p-1.5 rounded hover:bg-red-50 text-red-500"
                  title={t('common.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <FileText size={32} className="mx-auto mb-2 opacity-50" />
          <p>{t('templates.no_templates')}</p>
        </div>
      )}

      {showForm && (
        <TemplateForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function TemplateForm({ initial, onClose, onSaved }: { initial?: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || 'CUSTOM');
  const [body, setBody] = useState(initial?.body || '');
  const [showPreview, setShowPreview] = useState(false);

  const extractedVars = Array.from(new Set<string>((body.match(/\{\{(\w+)\}\}/g) || []).map((m: string) => m.replace(/\{\{|\}\}/g, ''))));

  const resolvePreview = (text: string) => {
    let resolved = text;
    for (const [key, value] of Object.entries(SAMPLE_VARS)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return resolved;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { name, category, body };
    if (initial) {
      await api.patch(`/templates/${initial.id}`, data);
    } else {
      await api.post('/templates', data);
    }
    onSaved();
  };

  const insertVariable = (varName: string) => {
    setBody((prev: string) => prev + `{{${varName}}}`);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{initial ? t('templates.edit_title') : t('templates.new_title')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('templates.template_name')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('templates.name_placeholder')} required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('templates.category_label')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(CATEGORY_KEYS[c])}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('templates.message_body')}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('templates.body_placeholder')}
              rows={5}
              required
              className="w-full border rounded px-3 py-2 text-sm font-mono"
            />
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] text-gray-400">{t('templates.insert_variable')}</span>
              {Object.keys(SAMPLE_VARS).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded hover:bg-blue-100 font-mono"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Detected variables */}
          {extractedVars.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('templates.detected_variables')}</p>
              <div className="flex flex-wrap gap-1">
                {extractedVars.map((v: string) => (
                  <span key={v} className={cn('text-[10px] px-1.5 py-0.5 rounded font-mono',
                    SAMPLE_VARS[v] ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                  )}>
                    {`{{${v}}}`} {SAMPLE_VARS[v] ? '' : t('templates.unknown_var')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Live preview */}
          <div>
            <button type="button" onClick={() => setShowPreview(!showPreview)} className="text-sm text-blue-600 hover:underline">
              {showPreview ? t('templates.hide_preview') : t('templates.show_preview')}
            </button>
            {showPreview && body && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded p-3 text-sm text-green-900">
                {resolvePreview(body)}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">{t('common.cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">{initial ? t('common.update') : t('common.create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
