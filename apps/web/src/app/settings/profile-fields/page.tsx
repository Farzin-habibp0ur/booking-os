'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { ArrowLeft } from 'lucide-react';
import { PROFILE_FIELDS } from '@booking-os/shared';

export default function ProfileFieldsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { toast } = useToast();
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<any>('/business').then((biz) => {
      setRequiredFields(biz.packConfig?.requiredProfileFields || []);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/business', { packConfig: { requiredProfileFields: requiredFields } });
      toast(t('common.saved'));
    } catch (e) {
      toast(t('errors.something_went_wrong'), 'error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <p className="text-slate-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/settings')}
          className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">
            {t('settings.profile_fields')}
          </h1>
          <p className="text-sm text-slate-500">{t('settings.profile_fields_desc')}</p>
        </div>
      </div>

      <div className="space-y-6">
        {(['basic', 'medical'] as const).map((category) => {
          const fields = PROFILE_FIELDS.filter((f) => f.category === category);
          if (fields.length === 0) return null;
          return (
            <div key={category} className="bg-white rounded-2xl shadow-soft p-6">
              <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">
                {t(`setup.profile_category_${category}` as any)}
              </h3>
              <div className="border border-slate-100 rounded-xl divide-y">
                {fields.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{field.label}</p>
                      <p className="text-xs text-slate-500">{field.type}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={requiredFields.includes(field.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRequiredFields([...requiredFields, field.key]);
                        } else {
                          setRequiredFields(requiredFields.filter((k) => k !== field.key));
                        }
                      }}
                      className="rounded text-sage-600 w-4 h-4"
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('settings.save_changes')}
        </button>
      </div>
    </div>
  );
}
