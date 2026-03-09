'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, BookOpen, DollarSign, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function portalFetch(path: string, opts?: RequestInit) {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('portal-token') : null;
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  }).then((r) => {
    if (r.status === 401) {
      sessionStorage.removeItem('portal-token');
      window.location.href = `/portal/${window.location.pathname.split('/')[2]}`;
      throw new Error('Unauthorized');
    }
    return r.json();
  });
}

export default function PortalProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('portal-token');
    if (!token) {
      router.replace(`/portal/${slug}`);
      return;
    }

    portalFetch('/portal/me')
      .then((prof) => {
        setProfile(prof);
        setName(prof.name || '');
        setEmail(prof.email || '');
        setPhone(prof.phone || '');
        const prefs = prof.preferences || {};
        setNotifyWhatsApp(prefs.notifyWhatsApp !== false);
        setNotifyEmail(prefs.notifyEmail !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, router]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await portalFetch('/portal/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, email, phone, notifyWhatsApp, notifyEmail }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error handled by portalFetch
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-6 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/portal/${slug}/dashboard`)}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h1 className="text-2xl font-serif font-semibold text-slate-900">My Profile</h1>
      </div>

      {/* Read-only stats */}
      <div className="grid grid-cols-3 gap-3" data-testid="profile-stats">
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <Calendar size={18} className="text-sage-600 mx-auto mb-1" />
          <p className="text-lg font-serif font-semibold text-slate-900">
            {profile?.memberSince
              ? new Date(profile.memberSince).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
              : '—'}
          </p>
          <p className="text-xs text-slate-500">Member Since</p>
        </div>
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <BookOpen size={18} className="text-lavender-600 mx-auto mb-1" />
          <p className="text-lg font-serif font-semibold text-slate-900">
            {profile?.totalBookings || 0}
          </p>
          <p className="text-xs text-slate-500">Total Visits</p>
        </div>
        <div className="bg-white rounded-2xl shadow-soft p-4 text-center">
          <DollarSign size={18} className="text-amber-600 mx-auto mb-1" />
          <p className="text-lg font-serif font-semibold text-slate-900">
            ${Number(profile?.totalSpent || 0).toFixed(0)}
          </p>
          <p className="text-xs text-slate-500">Total Spent</p>
        </div>
      </div>

      {/* Editable form */}
      <div className="bg-white rounded-2xl shadow-soft p-6">
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">
          Personal Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              data-testid="profile-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              data-testid="profile-email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              data-testid="profile-phone"
            />
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm font-medium text-slate-700 mb-2">Notification Preferences</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyWhatsApp}
                  onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-slate-600">WhatsApp notifications</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-slate-600">Email notifications</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-sage-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              data-testid="save-profile-btn"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && (
              <span className="text-sm text-sage-600" data-testid="save-success">
                Changes saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
