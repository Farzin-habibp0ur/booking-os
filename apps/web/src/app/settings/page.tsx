'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FileText, Languages } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function SettingsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<any>('/business').then((b) => {
      setBusiness(b);
      setName(b.name);
      setPhone(b.phone || '');
      setTimezone(b.timezone);
    });
  }, []);

  const handleSave = async () => {
    await api.patch('/business', { name, phone, timezone });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>

      <div className="bg-white border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold">{t('settings.business_info')}</h2>

        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.business_name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.phone')}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.timezone')}</label>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('settings.vertical_pack')}</label>
          <input value={business?.verticalPack || ''} disabled className="w-full border rounded px-3 py-2 text-sm bg-gray-50" />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            {t('settings.save_changes')}
          </button>
          {saved && <span className="text-green-600 text-sm">{t('common.saved')}</span>}
        </div>
      </div>
      {/* Quick links */}
      <div className="bg-white border rounded-lg p-6 mt-6">
        <h2 className="font-semibold mb-3">{t('settings.more_settings')}</h2>
        <div className="space-y-2">
          <button
            onClick={() => router.push('/settings/templates')}
            className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-gray-50 border"
          >
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileText size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('settings.message_templates')}</p>
              <p className="text-xs text-gray-500">{t('settings.message_templates_desc')}</p>
            </div>
          </button>
          <button
            onClick={() => router.push('/settings/translations')}
            className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-gray-50 border"
          >
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Languages size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('settings.translations')}</p>
              <p className="text-xs text-gray-500">{t('settings.translations_desc')}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
