'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ClipboardList } from 'lucide-react';

interface WaitlistSettings {
  offerCount: number;
  expiryMinutes: number;
  quietStart: string;
  quietEnd: string;
}

export default function WaitlistSettingsPage() {
  const [settings, setSettings] = useState<WaitlistSettings>({
    offerCount: 3,
    expiryMinutes: 15,
    quietStart: '21:00',
    quietEnd: '09:00',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<WaitlistSettings>('/business/waitlist-settings')
      .then((s) => {
        setSettings(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    await api.patch('/business/waitlist-settings', settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading)
    return (
      <div className="p-6">
        <p className="text-slate-400">Loading...</p>
      </div>
    );

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-6">
        <ClipboardList size={24} className="text-sage-600" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Waitlist Settings</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-soft p-6 space-y-6">
        <p className="text-sm text-slate-500">
          Configure how the waitlist backfill system works when a booking is cancelled.
        </p>

        {/* Offer count */}
        <div>
          <p className="text-sm font-medium mb-1">Customers to notify</p>
          <p className="text-xs text-slate-500 mb-3">
            How many waitlisted customers should be offered the open slot simultaneously.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={5}
              value={settings.offerCount}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  offerCount: Math.max(1, Math.min(5, Number(e.target.value) || 1)),
                })
              }
              className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <span className="text-sm text-slate-500">customers</span>
          </div>
        </div>

        <hr />

        {/* Expiry */}
        <div>
          <p className="text-sm font-medium mb-1">Offer expiry</p>
          <p className="text-xs text-slate-500 mb-3">
            How long customers have to claim the slot before the offer expires.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={60}
              value={settings.expiryMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  expiryMinutes: Math.max(5, Math.min(60, Number(e.target.value) || 5)),
                })
              }
              className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm"
            />
            <span className="text-sm text-slate-500">minutes</span>
          </div>
        </div>

        <hr />

        {/* Quiet hours */}
        <div>
          <p className="text-sm font-medium mb-1">Quiet hours</p>
          <p className="text-xs text-slate-500 mb-3">
            No waitlist notifications will be sent during quiet hours.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500">From</label>
              <input
                type="time"
                value={settings.quietStart}
                onChange={(e) => setSettings({ ...settings, quietStart: e.target.value })}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-500">To</label>
              <input
                type="time"
                value={settings.quietEnd}
                onChange={(e) => setSettings({ ...settings, quietEnd: e.target.value })}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
          >
            Save Changes
          </button>
          {saved && <span className="text-sage-600 text-sm">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
