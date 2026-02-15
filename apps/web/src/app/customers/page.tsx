'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Search, Plus, ChevronRight, Users, Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';

export default function CustomersPage() {
  const router = useRouter();
  const pack = usePack();
  const { t } = useI18n();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

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
          <h1 className="text-2xl font-serif font-semibold text-slate-900">{t('customers.title', { entity: pack.labels.customer })}</h1>
          <p className="text-sm text-slate-500">{t('customers.total_count', { count: customers.total || customers.data?.length || 0, entity: pack.labels.customer.toLowerCase() })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1 border px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors">
            <Upload size={16} /> {t('import.import_button')}
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 bg-sage-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors">
            <Plus size={16} /> {t('customers.add_button', { entity: pack.labels.customer })}
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (!e.target.value) load(''); }}
            placeholder={t('customers.search_placeholder')}
            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
          />
        </div>
        <button type="submit" className="border rounded-xl px-4 py-2 text-sm hover:bg-slate-50 transition-colors">{t('common.search')}</button>
      </form>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">{t('common.name')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">{t('common.phone')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">{t('common.email')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">{t('common.tags')}</th>
              <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">{t('common.date')}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
            ) : (
              (customers.data || []).map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/customers/${c.id}`)}>
                  <td className="p-3 text-sm font-medium">{c.name}</td>
                  <td className="p-3 text-sm text-slate-600">{c.phone}</td>
                  <td className="p-3 text-sm text-slate-600">{c.email || '—'}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {c.tags?.map((tg: string) => (
                        <span key={tg} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{tg}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="p-3"><ChevronRight size={14} className="text-slate-400" /></td>
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
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(); }} />}
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
      <div className="bg-white rounded-2xl shadow-soft-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">{t('customers.add_title', { entity: pack.labels.customer })}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('customers.name_placeholder')} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('customers.phone_placeholder')} required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('customers.email_placeholder')} type="email" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl text-sm transition-colors">{t('common.cancel')}</button>
            <button type="submit" className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors">{t('common.create')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Array<{ name: string; phone: string; email: string; tags: string }>>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);
  const [includeMessages, setIncludeMessages] = useState(true);
  const [convImporting, setConvImporting] = useState(false);
  const [convResult, setConvResult] = useState<{ created: number; updated: number } | null>(null);

  const handleCsvSelect = (file: File) => {
    setCsvFile(file);
    setCsvResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').filter((l) => l.trim());
      if (lines.length < 2) return;
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIdx = header.findIndex((h) => h === 'name');
      const phoneIdx = header.findIndex((h) => h === 'phone');
      const emailIdx = header.findIndex((h) => h === 'email');
      const tagsIdx = header.findIndex((h) => h === 'tags');
      const rows = lines.slice(1, 11).map((line) => {
        const cols = line.split(',').map((c) => c.trim());
        return {
          name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
          phone: phoneIdx >= 0 ? cols[phoneIdx] || '' : '',
          email: emailIdx >= 0 ? cols[emailIdx] || '' : '',
          tags: tagsIdx >= 0 ? cols[tagsIdx] || '' : '',
        };
      });
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  };

  const importCsv = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const result = await api.upload<{ created: number; skipped: number; errors: number }>('/customers/import-csv', formData);
      setCsvResult(result);
      toast(t('import.csv_success', { created: result.created, skipped: result.skipped }));
    } catch (e) {
      toast(t('import.csv_failed'), 'error');
    }
    setCsvImporting(false);
  };

  const importFromConversations = async () => {
    setConvImporting(true);
    try {
      const result = await api.post<{ created: number; updated: number }>('/customers/import-from-conversations', { includeMessages });
      setConvResult(result);
      toast(t('import.conversations_success', { updated: result.updated }));
    } catch (e) {
      toast(t('import.conversations_failed'), 'error');
    }
    setConvImporting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-soft-lg w-full max-w-lg max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-serif font-semibold text-slate-900">{t('import.modal_title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-6">
          {/* CSV Import */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t('import.csv_title')}</h3>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-sage-500 transition-colors"
            >
              <Upload size={20} className="mx-auto text-slate-400 mb-1" />
              <p className="text-xs text-slate-600">{csvFile ? csvFile.name : t('import.csv_drop_zone')}</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleCsvSelect(e.target.files[0])} />

            {csvPreview.length > 0 && (
              <div className="border rounded-xl overflow-auto max-h-32">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-1.5">{t('common.name')}</th>
                      <th className="text-left p-1.5">{t('common.phone')}</th>
                      <th className="text-left p-1.5">{t('common.email')}</th>
                      <th className="text-left p-1.5">{t('common.tags')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {csvPreview.map((row, i) => (
                      <tr key={i}>
                        <td className="p-1.5">{row.name}</td>
                        <td className="p-1.5">{row.phone}</td>
                        <td className="p-1.5">{row.email}</td>
                        <td className="p-1.5">{row.tags}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {csvFile && (
              <button onClick={importCsv} disabled={csvImporting} className="bg-sage-600 text-white px-3 py-1.5 rounded-xl text-sm hover:bg-sage-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                {csvImporting && <Loader2 size={14} className="animate-spin" />}
                {t('import.import_button')}
              </button>
            )}

            {csvResult && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                {t('import.csv_result', { created: csvResult.created, skipped: csvResult.skipped, errors: csvResult.errors })}
              </p>
            )}
          </div>

          <hr />

          {/* Conversation Import */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t('import.conversations_title')}</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeMessages} onChange={(e) => setIncludeMessages(e.target.checked)} className="rounded text-lavender-600" />
              <span className="text-xs">{t('import.include_messages')}</span>
            </label>
            <button onClick={importFromConversations} disabled={convImporting} className="bg-lavender-600 text-white px-3 py-1.5 rounded-xl text-sm hover:bg-lavender-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
              {convImporting && <Loader2 size={14} className="animate-spin" />}
              {t('import.generate_profiles')}
            </button>
            {convResult && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                {t('import.conversations_result', { created: convResult.created, updated: convResult.updated })}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end">
          <button onClick={() => { onImported(); }} className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors">{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
