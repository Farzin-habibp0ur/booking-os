'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Clock, DollarSign, Shield, Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);
  const pack = usePack();
  const { t } = useI18n();

  const load = () => api.get<any[]>('/services').then(setServices);

  useEffect(() => {
    load();
  }, []);

  const filtered = showInactive ? services : services.filter((s) => s.isActive !== false);
  const categories = [...new Set(services.map((s) => s.category))];

  const toggleActive = async (svc: any) => {
    await api.patch(`/services/${svc.id}`, { isActive: !svc.isActive });
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">
            {t('services.title', { entity: pack.labels.service })}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('services.active_count', {
              count: services.filter((s) => s.isActive !== false).length,
              entity: pack.labels.service.toLowerCase(),
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            {t('services.show_inactive')}
          </label>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1 bg-sage-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
          >
            <Plus size={16} /> {t('services.add_button', { entity: pack.labels.service })}
          </button>
        </div>
      </div>

      {categories.map((cat) => {
        const catServices = filtered.filter((s) => s.category === cat);
        if (catServices.length === 0) return null;
        return (
          <div key={cat} className="mb-6">
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
              {cat}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catServices.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    'bg-white rounded-2xl shadow-soft p-4 transition-opacity',
                    s.isActive === false && 'opacity-50',
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{s.name}</h3>
                        {s.isActive === false && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                            {t('services.inactive_badge')}
                          </span>
                        )}
                        {s.depositRequired && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                            {t('services.deposit_badge')}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditing(s);
                        setShowForm(true);
                      }}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {s.durationMins} {t('services.min_short')}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />{' '}
                      {s.price > 0 ? `$${s.price}` : t('services.price_free')}
                    </span>
                  </div>
                  {(s.bufferBefore > 0 || s.bufferAfter > 0) && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <Timer size={10} />
                      {s.bufferBefore > 0 && (
                        <span>{t('services.buffer_before', { count: s.bufferBefore })}</span>
                      )}
                      {s.bufferAfter > 0 && (
                        <span>{t('services.buffer_after', { count: s.bufferAfter })}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <p>{t('services.no_services')}</p>
        </div>
      )}

      {showForm && (
        <ServiceForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
          onToggleActive={
            editing
              ? () => {
                  toggleActive(editing);
                  setShowForm(false);
                  load();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function ServiceForm({
  initial,
  onClose,
  onSaved,
  onToggleActive,
}: {
  initial?: any;
  onClose: () => void;
  onSaved: () => void;
  onToggleActive?: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [durationMins, setDurationMins] = useState(initial?.durationMins || 30);
  const [price, setPrice] = useState(initial?.price || 0);
  const [category, setCategory] = useState(initial?.category || 'General');
  const [depositRequired, setDepositRequired] = useState(initial?.depositRequired || false);
  const [bufferBefore, setBufferBefore] = useState(initial?.bufferBefore || 0);
  const [bufferAfter, setBufferAfter] = useState(initial?.bufferAfter || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name,
      description: description || undefined,
      durationMins: Number(durationMins),
      price: Number(price),
      category,
      depositRequired,
      bufferBefore: Number(bufferBefore),
      bufferAfter: Number(bufferAfter),
    };
    if (initial) {
      await api.patch(`/services/${initial.id}`, data);
    } else {
      await api.post('/services', data);
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-soft-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">
          {initial ? t('services.form_title_edit') : t('services.form_title_add')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('services.name_label')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('services.name_placeholder')}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {t('services.description_label')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('services.description_placeholder')}
              rows={2}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('services.duration_label')}
              </label>
              <input
                value={durationMins}
                onChange={(e) => setDurationMins(e.target.value)}
                type="number"
                min="5"
                step="5"
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('services.price_label')}</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                step="0.01"
                min="0"
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('services.category_label')}
              </label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t('services.category_placeholder')}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('services.buffer_before_label')}
              </label>
              <input
                value={bufferBefore}
                onChange={(e) => setBufferBefore(e.target.value)}
                type="number"
                min="0"
                step="5"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                {t('services.buffer_before_hint')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t('services.buffer_after_label')}
              </label>
              <input
                value={bufferAfter}
                onChange={(e) => setBufferAfter(e.target.value)}
                type="number"
                min="0"
                step="5"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">{t('services.buffer_after_hint')}</p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={depositRequired}
              onChange={(e) => setDepositRequired(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">{t('services.deposit_required')}</span>
          </label>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              {initial && onToggleActive && (
                <button
                  type="button"
                  onClick={onToggleActive}
                  className={cn(
                    'text-sm px-3 py-1.5 rounded transition-colors',
                    initial.isActive !== false
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-sage-600 hover:bg-sage-50',
                  )}
                >
                  {initial.isActive !== false ? t('services.deactivate') : t('services.reactivate')}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-xl text-sm transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
              >
                {initial ? t('common.update') : t('common.create')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
