'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FileText } from 'lucide-react';

export default function SettingsPage() {
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
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white border rounded-lg p-6 space-y-4">
        <h2 className="font-semibold">Business Information</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Business Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Timezone</label>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Vertical Pack</label>
          <input value={business?.verticalPack || ''} disabled className="w-full border rounded px-3 py-2 text-sm bg-gray-50" />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
            Save Changes
          </button>
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
        </div>
      </div>
      {/* Quick links */}
      <div className="bg-white border rounded-lg p-6 mt-6">
        <h2 className="font-semibold mb-3">More Settings</h2>
        <button
          onClick={() => router.push('/settings/templates')}
          className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-gray-50 border"
        >
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
            <FileText size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Message Templates</p>
            <p className="text-xs text-gray-500">Manage confirmation, reminder, and follow-up templates</p>
          </div>
        </button>
      </div>
    </div>
  );
}
