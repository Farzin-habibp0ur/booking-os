'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ArrowLeft, Plus, Trash2, Tag } from 'lucide-react';

export default function OffersSettingsPage() {
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', terms: '', validFrom: '', validUntil: '' });
  const router = useRouter();

  const load = () => {
    api
      .get<any>('/offers')
      .then((data) => setOffers(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    await api.post('/offers', {
      name: form.name,
      description: form.description || undefined,
      terms: form.terms || undefined,
      validFrom: form.validFrom || undefined,
      validUntil: form.validUntil || undefined,
    });
    setShowForm(false);
    setForm({ name: '', description: '', terms: '', validFrom: '', validUntil: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this offer?')) return;
    await api.del(`/offers/${id}`);
    load();
  };

  const handleToggle = async (offer: any) => {
    await api.patch(`/offers/${offer.id}`, { isActive: !offer.isActive });
    load();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => router.push('/settings')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={16} /> Back to Settings
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-serif font-semibold text-slate-900">Offers</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
        >
          <Plus size={16} />
          New Offer
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-soft p-5 mb-4 space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Offer name"
            className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description (optional)"
            rows={2}
            className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
          />
          <input
            value={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.value })}
            placeholder="Terms & conditions (optional)"
            className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Valid from</label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Valid until</label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!form.name}
              className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              Create
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {loading && <div className="text-sm text-slate-400 py-4 text-center">Loading...</div>}
        {!loading && offers.length === 0 && !showForm && (
          <div className="text-center py-8">
            <Tag size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">No offers yet. Create one to include in campaigns.</p>
          </div>
        )}
        {offers.map((offer) => (
          <div key={offer.id} className="bg-white rounded-2xl shadow-soft p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">{offer.name}</p>
              {offer.description && <p className="text-xs text-slate-500 mt-0.5">{offer.description}</p>}
              <div className="flex items-center gap-2 mt-1">
                <span className={cn('text-xs px-2 py-0.5 rounded-full', offer.isActive ? 'bg-sage-50 text-sage-700' : 'bg-slate-100 text-slate-500')}>
                  {offer.isActive ? 'Active' : 'Inactive'}
                </span>
                {offer.validUntil && (
                  <span className="text-xs text-slate-400">
                    Until {new Date(offer.validUntil).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggle(offer)}
                className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                {offer.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => handleDelete(offer.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
