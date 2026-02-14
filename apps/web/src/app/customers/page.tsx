'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Search, Plus, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';

export default function CustomersPage() {
  const router = useRouter();
  const pack = usePack();
  const { t } = useI18n();
  const [customers, setCustomers] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = (s?: string) => {
    api.get<any>(`/customers?search=${s || search}&pageSize=50`).then(setCustomers).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{t('customers.title', { entity: pack.labels.customer })}</h1>
          <p className="text-sm text-gray-500">{t('customers.total_count', { count: customers.total || customers.data?.length || 0, entity: pack.labels.customer.toLowerCase() })}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700">
          <Plus size={16} /> {t('customers.add_button', { entity: pack.labels.customer })}
        </button>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (!e.target.value) load(''); }}
            placeholder={t('customers.search_placeholder')}
            className="w-full border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="border rounded-md px-4 py-2 text-sm hover:bg-gray-50">{t('common.search')}</button>
      </form>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('common.name')}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('common.phone')}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('common.email')}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('common.tags')}</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">{t('common.date')}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
            ) : (
              (customers.data || []).map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/customers/${c.id}`)}>
                  <td className="p-3 text-sm font-medium">{c.name}</td>
                  <td className="p-3 text-sm text-gray-600">{c.phone}</td>
                  <td className="p-3 text-sm text-gray-600">{c.email || '—'}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {c.tags?.map((t: string) => (
                        <span key={t} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="p-3"><ChevronRight size={14} className="text-gray-400" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && (!customers.data || customers.data.length === 0) && (
          <EmptyState
            icon={Users}
            title={t('customers.no_customers', { entity: pack.labels.customer.toLowerCase() })}
            description={search ? t('customers.no_search_results', { query: search }) : t('customers.add_first', { entity: pack.labels.customer.toLowerCase() })}
            action={!search ? { label: t('customers.add_button', { entity: pack.labels.customer }), onClick: () => setShowForm(true) } : undefined}
          />
        )}
      </div>

      {showForm && <CustomerForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CustomerForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useI18n();
  const pack = usePack();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/customers', { name, phone, email: email || undefined });
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">{t('customers.add_title', { entity: pack.labels.customer })}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('customers.name_placeholder')} required className="w-full border rounded px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('customers.phone_placeholder')} required className="w-full border rounded px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('customers.email_placeholder')} type="email" className="w-full border rounded px-3 py-2 text-sm" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">{t('common.cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">{t('common.create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
