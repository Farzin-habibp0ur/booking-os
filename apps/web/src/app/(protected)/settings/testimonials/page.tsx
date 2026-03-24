'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { ArrowLeft, Star } from 'lucide-react';

export default function TestimonialSettingsPage() {
  const [settings, setSettings] = useState<any>({
    emailSubject: "We'd love your feedback!",
    emailBody: '',
    autoApprove5Star: false,
    autoApproveRepeat: false,
    maxFeatured: 6,
    showRatings: true,
    showAuthorInfo: true,
    reminderDays: 0,
    maxRequestsPer90Days: 1,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    api
      .get<any>('/business')
      .then((biz) => {
        const config = biz.packConfig || {};
        if (config.testimonials) {
          setSettings((prev: any) => ({ ...prev, ...config.testimonials }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/business', {
        packConfig: { testimonials: settings },
      });
      toast('Settings saved');
    } catch {
      toast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.push('/settings')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={16} /> Back to Settings
      </button>

      <div className="flex items-center gap-2 mb-6">
        <Star size={20} className="text-amber-400" />
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Testimonial Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Email Template */}
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Email Template</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Subject Line</label>
              <input
                value={settings.emailSubject}
                onChange={(e) => setSettings({ ...settings, emailSubject: e.target.value })}
                className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">CTA Button Text</label>
              <input
                value={settings.ctaText || 'Share Your Experience'}
                onChange={(e) => setSettings({ ...settings, ctaText: e.target.value })}
                className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
            </div>
          </div>
        </div>

        {/* Auto-Approve Rules */}
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Auto-Approve Rules</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Auto-approve 5-star testimonials</span>
              <input
                type="checkbox"
                checked={settings.autoApprove5Star}
                onChange={(e) => setSettings({ ...settings, autoApprove5Star: e.target.checked })}
                className="rounded text-sage-600"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-700">
                Auto-approve from repeat customers (3+ bookings)
              </span>
              <input
                type="checkbox"
                checked={settings.autoApproveRepeat}
                onChange={(e) => setSettings({ ...settings, autoApproveRepeat: e.target.checked })}
                className="rounded text-sage-600"
              />
            </label>
          </div>
        </div>

        {/* Display Preferences */}
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Display Preferences</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Max featured testimonials</label>
              <input
                type="number"
                min={1}
                max={12}
                value={settings.maxFeatured}
                onChange={(e) => setSettings({ ...settings, maxFeatured: Number(e.target.value) })}
                className="w-20 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
            </div>
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Show ratings on public page</span>
              <input
                type="checkbox"
                checked={settings.showRatings}
                onChange={(e) => setSettings({ ...settings, showRatings: e.target.checked })}
                className="rounded text-sage-600"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Show author info on public page</span>
              <input
                type="checkbox"
                checked={settings.showAuthorInfo}
                onChange={(e) => setSettings({ ...settings, showAuthorInfo: e.target.checked })}
                className="rounded text-sage-600"
              />
            </label>
          </div>
        </div>

        {/* Request Behavior */}
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Request Behavior</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Auto-send reminder after (days, 0 = disabled)
              </label>
              <input
                type="number"
                min={0}
                max={14}
                value={settings.reminderDays}
                onChange={(e) => setSettings({ ...settings, reminderDays: Number(e.target.value) })}
                className="w-20 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Max requests per customer (per 90 days)
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={settings.maxRequestsPer90Days}
                onChange={(e) =>
                  setSettings({ ...settings, maxRequestsPer90Days: Number(e.target.value) })
                }
                className="w-20 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-sage-600 text-white rounded-xl text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
