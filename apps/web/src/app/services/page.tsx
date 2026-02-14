'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Clock, DollarSign, Shield, Timer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showInactive, setShowInactive] = useState(false);
  const pack = usePack();

  const load = () => api.get<any[]>('/services').then(setServices);

  useEffect(() => { load(); }, []);

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
          <h1 className="text-2xl font-bold">{pack.labels.service}s</h1>
          <p className="text-sm text-gray-500 mt-1">{services.filter((s) => s.isActive !== false).length} active {pack.labels.service.toLowerCase()}s</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">
            <Plus size={16} /> Add {pack.labels.service}
          </button>
        </div>
      </div>

      {categories.map((cat) => {
        const catServices = filtered.filter((s) => s.category === cat);
        if (catServices.length === 0) return null;
        return (
          <div key={cat} className="mb-6">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {catServices.map((s) => (
                <div key={s.id} className={cn('bg-white border rounded-lg p-4 transition-opacity', s.isActive === false && 'opacity-50')}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{s.name}</h3>
                        {s.isActive === false && (
                          <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Inactive</span>
                        )}
                        {s.depositRequired && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Deposit</span>
                        )}
                      </div>
                      {s.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</p>}
                    </div>
                    <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded">
                      <Pencil size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Clock size={12} /> {s.durationMins} min</span>
                    <span className="flex items-center gap-1"><DollarSign size={12} /> {s.price > 0 ? `$${s.price}` : 'Free'}</span>
                  </div>
                  {(s.bufferBefore > 0 || s.bufferAfter > 0) && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <Timer size={10} />
                      {s.bufferBefore > 0 && <span>{s.bufferBefore}min before</span>}
                      {s.bufferAfter > 0 && <span>{s.bufferAfter}min after</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No services yet. Add your first service to get started.</p>
        </div>
      )}

      {showForm && (
        <ServiceForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
          onToggleActive={editing ? () => { toggleActive(editing); setShowForm(false); load(); } : undefined}
        />
      )}
    </div>
  );
}

function ServiceForm({ initial, onClose, onSaved, onToggleActive }: { initial?: any; onClose: () => void; onSaved: () => void; onToggleActive?: () => void }) {
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
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Edit' : 'Add'} Service</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Botox, Consultation" required className="w-full border rounded px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the service" rows={2} className="w-full border rounded px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Duration (min) *</label>
              <input value={durationMins} onChange={(e) => setDurationMins(e.target.value)} type="number" min="5" step="5" required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Price ($) *</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" min="0" required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="General" required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Buffer Before (min)</label>
              <input value={bufferBefore} onChange={(e) => setBufferBefore(e.target.value)} type="number" min="0" step="5" className="w-full border rounded px-3 py-2 text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Prep time before appointment</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Buffer After (min)</label>
              <input value={bufferAfter} onChange={(e) => setBufferAfter(e.target.value)} type="number" min="0" step="5" className="w-full border rounded px-3 py-2 text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Cleanup time after appointment</p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={depositRequired} onChange={(e) => setDepositRequired(e.target.checked)} className="rounded" />
            <span className="text-sm">Require deposit for this service</span>
          </label>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              {initial && onToggleActive && (
                <button type="button" onClick={onToggleActive} className={cn('text-sm px-3 py-1.5 rounded', initial.isActive !== false ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50')}>
                  {initial.isActive !== false ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">{initial ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
