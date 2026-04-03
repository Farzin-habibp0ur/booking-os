'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useListNavigation, useKeyboardShortcut } from '@/lib/use-keyboard-shortcut';
import {
  Search,
  Plus,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Users,
  Upload,
  X,
  Loader2,
  Tag,
  AlertTriangle,
  RefreshCw,
  Download,
  Copy,
} from 'lucide-react';
import BulkActionBar from '@/components/bulk-action-bar';
import ExportModal from '@/components/export-modal';
import { cn } from '@/lib/cn';
import { usePack } from '@/lib/vertical-pack';
import { useI18n } from '@/lib/i18n';
import { TableRowSkeleton, EmptyState } from '@/components/skeleton';
import { ViewPicker } from '@/components/saved-views';

export default function CustomersPage() {
  const router = useRouter();
  const pack = usePack();
  const { t } = useI18n();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any>({ data: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagModal, setBulkTagModal] = useState<'tag' | 'untag' | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [sortBy, setSortBy] = useState<
    'name' | 'phone' | 'email' | 'date' | 'lastVisit' | 'totalSpent' | 'bookingsCount' | null
  >(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const retryCountRef = useRef(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [keyboardIdx, setKeyboardIdx] = useState(-1);

  const currentFilters = { search };

  const handleApplyView = (filters: Record<string, unknown>, viewId: string) => {
    const newSearch = (filters.search as string) || '';
    setSearch(newSearch);
    setActiveViewId(viewId);
    load(newSearch);
  };

  const handleClearView = () => {
    setSearch('');
    setActiveViewId(null);
    load('');
  };

  const load = (s?: string) => {
    setLoading(true);
    setError(false);
    api
      .get<any>(`/customers?search=${s ?? search}&pageSize=50`)
      .then((data) => {
        setCustomers(data);
        retryCountRef.current = 0;
        setLoading(false);
      })
      .catch((err: any) => {
        if (retryCountRef.current < 1) {
          retryCountRef.current += 1;
          setTimeout(() => load(s), 1500);
        } else {
          toast(
            err.message ||
              t('customers.load_error', { entity: pack.labels.customer.toLowerCase() }),
            'error',
          );
          setError(true);
          setLoading(false);
          retryCountRef.current = 0;
        }
      });
  };

  useEffect(() => {
    load();
    api
      .get<any>('/customers/duplicates?status=PENDING&pageSize=1')
      .then((res) => setDuplicateCount(res.total || 0))
      .catch(() => {});
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const data = customers.data || [];
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((c: any) => c.id)));
    }
  };

  const handleBulkTag = async () => {
    if (!tagInput.trim() || !bulkTagModal) return;
    await api.patch('/customers/bulk', {
      ids: Array.from(selectedIds),
      action: bulkTagModal,
      payload: { tag: tagInput.trim() },
    });
    setSelectedIds(new Set());
    setBulkTagModal(null);
    setTagInput('');
    load();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const handleSearchChange = (query: string) => {
    setSearch(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query) {
      load('');
    } else {
      searchTimeoutRef.current = setTimeout(() => load(query), 300);
    }
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const getSortedCustomers = () => {
    if (!sortBy) return customers.data || [];
    const data = [...(customers.data || [])];
    const dir = sortDir === 'asc' ? 1 : -1;

    return data.sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;

      if (sortBy === 'date') {
        aVal = new Date(a.createdAt);
        bVal = new Date(b.createdAt);
      } else if (sortBy === 'lastVisit') {
        aVal = a.bookings?.[0]?.startTime ? new Date(a.bookings[0].startTime) : new Date(0);
        bVal = b.bookings?.[0]?.startTime ? new Date(b.bookings[0].startTime) : new Date(0);
      } else if (sortBy === 'totalSpent') {
        aVal = a.totalSpent ?? 0;
        bVal = b.totalSpent ?? 0;
      } else if (sortBy === 'bookingsCount') {
        aVal = a.bookingsCount ?? a._count?.bookings ?? 0;
        bVal = b.bookingsCount ?? b._count?.bookings ?? 0;
      } else {
        aVal = a[sortBy];
        bVal = b[sortBy];
      }

      if (typeof aVal === 'string') {
        return aVal.localeCompare(bVal || '') * dir;
      }
      return ((aVal || 0) > (bVal || 0) ? 1 : -1) * dir;
    });
  };

  const sortedCustomerList = getSortedCustomers();
  useListNavigation(sortedCustomerList.length, setKeyboardIdx);
  useKeyboardShortcut('Enter', () => {
    if (keyboardIdx >= 0 && keyboardIdx < sortedCustomerList.length) {
      router.push(`/customers/${sortedCustomerList[keyboardIdx].id}`);
    }
  });

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return null;
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="text-sage-600" />
    ) : (
      <ChevronDown size={14} className="text-sage-600" />
    );
  };

  return (
    <div className="p-6" data-tour-target="customers-table">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">
            {t('customers.title', { entity: pack.labels.customer })}
          </h1>
          <p className="text-sm text-slate-500">
            {t('customers.total_count', {
              count: customers.total || customers.data?.length || 0,
              entity: pack.labels.customer.toLowerCase(),
            })}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          {duplicateCount > 0 && (
            <button
              onClick={() => router.push('/customers/duplicates')}
              className="flex items-center justify-center gap-1 border border-amber-200 bg-amber-50 px-3 py-2 rounded-xl text-sm text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <Copy size={16} /> Review Duplicates
              <span className="bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full ml-1">
                {duplicateCount}
              </span>
            </button>
          )}
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center justify-center gap-1 border px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center justify-center gap-1 border px-3 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            <Upload size={16} /> {t('import.import_button')}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-1 bg-sage-600 text-white px-3 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
          >
            <Plus size={16} /> {t('customers.add_button', { entity: pack.labels.customer })}
          </button>
        </div>
      </div>

      <ViewPicker
        page="customers"
        currentFilters={currentFilters}
        activeViewId={activeViewId}
        onApplyView={handleApplyView}
        onClearView={handleClearView}
      />

      <div className="mb-4 flex gap-2">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('customers.search_placeholder')}
            data-search-input
            className="w-full rounded-xl bg-slate-50 border-0 focus:ring-2 focus:ring-sage-500 pl-9 pr-9 py-2 text-sm focus:outline-none focus:bg-white transition-colors"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={
                      (customers.data || []).length > 0 &&
                      selectedIds.size === (customers.data || []).length
                    }
                    onChange={toggleSelectAll}
                    className="rounded text-sage-600"
                  />
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors group"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    {t('common.name')}
                    <SortIcon column="name" />
                  </div>
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                  onClick={() => handleSort('phone')}
                >
                  <div className="flex items-center gap-1">
                    {t('common.phone')}
                    <SortIcon column="phone" />
                  </div>
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center gap-1">
                    {t('common.email')}
                    <SortIcon column="email" />
                  </div>
                </th>
                <th className="text-left p-3 text-xs font-medium text-slate-500 uppercase">
                  {t('common.tags')}
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                  onClick={() => handleSort('lastVisit')}
                >
                  <div className="flex items-center gap-1">
                    Last Visit
                    <SortIcon column="lastVisit" />
                  </div>
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                  onClick={() => handleSort('totalSpent')}
                >
                  <div className="flex items-center gap-1">
                    Total Spent
                    <SortIcon column="totalSpent" />
                  </div>
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                  onClick={() => handleSort('bookingsCount')}
                >
                  <div className="flex items-center gap-1">
                    Bookings
                    <SortIcon column="bookingsCount" />
                  </div>
                </th>
                <th
                  className="text-left p-3 text-xs font-medium text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    {t('common.date')}
                    <SortIcon column="date" />
                  </div>
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={10} />)
                : sortedCustomerList.map((c: any, idx: number) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className={cn(
                        'hover:bg-slate-50 cursor-pointer',
                        selectedIds.has(c.id) && 'bg-sage-50/50',
                        keyboardIdx === idx && 'bg-sage-50 border-l-2 border-sage-600',
                      )}
                    >
                      <td className="w-10 p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded text-sage-600"
                        />
                      </td>
                      <td className="p-3 text-sm font-medium">
                        <Link href={`/customers/${c.id}`} className="hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="p-3 text-sm text-slate-600">{c.phone}</td>
                      <td className="p-3 text-sm text-slate-600">{c.email || '—'}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {c.tags?.map((tg: string) => (
                            <span
                              key={tg}
                              className="text-xs bg-slate-100 px-2 py-0.5 rounded-full"
                            >
                              {tg}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-slate-500">
                        {c.bookings?.[0]?.startTime
                          ? new Date(c.bookings[0].startTime).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="p-3 text-sm text-slate-500">
                        {c.totalSpent != null ? `$${Number(c.totalSpent).toFixed(2)}` : '—'}
                      </td>
                      <td className="p-3 text-sm text-slate-500">
                        {c.bookingsCount ?? c._count?.bookings ?? '—'}
                      </td>
                      <td className="p-3 text-sm text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <ChevronRight size={14} className="text-slate-400" />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && error && (!customers.data || customers.data.length === 0) && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-testid="error-state"
          >
            <AlertTriangle size={48} className="text-amber-400 mb-3" />
            <h3 className="text-lg font-medium text-slate-600 mb-1">
              {t('customers.load_error_title')}
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mb-4">
              {t('customers.load_error_description')}
            </p>
            <button
              onClick={() => load()}
              data-testid="retry-button"
              className="flex items-center gap-2 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
            >
              <RefreshCw size={14} />
              {t('common.retry')}
            </button>
          </div>
        )}
        {!loading && !error && (!customers.data || customers.data.length === 0) && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Users size={32} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-serif font-semibold text-slate-900 mb-2">
              {search
                ? t('customers.no_search_results', { query: search })
                : t('customers.no_customers', { entity: pack.labels.customer.toLowerCase() })}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mb-6">
              {search
                ? t('customers.try_different_search')
                : t('customers.add_first', { entity: pack.labels.customer.toLowerCase() })}
            </p>
            {!search && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 border border-slate-200 text-slate-700 px-6 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors active:scale-95"
                >
                  <Upload size={16} />
                  Import CSV
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 bg-sage-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-sage-700 transition-colors active:scale-95"
                >
                  <Plus size={16} />
                  Add Manually
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <BulkActionBar
        count={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          {
            label: 'Add Tag',
            onClick: () => {
              setTagInput('');
              setBulkTagModal('tag');
            },
          },
          {
            label: 'Remove Tag',
            onClick: () => {
              setTagInput('');
              setBulkTagModal('untag');
            },
          },
        ]}
      />

      {bulkTagModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-soft p-6 w-full max-w-sm">
            <h3 className="text-lg font-serif font-semibold mb-4">
              {bulkTagModal === 'tag' ? 'Add Tag' : 'Remove Tag'}
            </h3>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Enter tag name"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleBulkTag()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setBulkTagModal(null)}
                className="px-4 py-2 border rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkTag}
                disabled={!tagInput.trim()}
                className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 disabled:opacity-50 transition-colors"
              >
                {bulkTagModal === 'tag' ? 'Add' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <CustomerForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        entity="customers"
        allFields={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'tags', label: 'Tags' },
          { key: 'createdAt', label: 'Created' },
          { key: 'updatedAt', label: 'Updated' },
        ]}
      />
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
        <h2 className="text-lg font-serif font-semibold text-slate-900 mb-4">
          {t('customers.add_title', { entity: pack.labels.customer })}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('customers.name_placeholder')}
            required
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('customers.phone_placeholder')}
            required
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('customers.email_placeholder')}
            type="email"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-sm transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
            >
              {t('common.create')}
            </button>
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
  const [csvPreview, setCsvPreview] = useState<
    Array<{ name: string; phone: string; email: string; tags: string }>
  >([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    created: number;
    skipped: number;
    errors: number;
  } | null>(null);
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
      const result = await api.upload<{ created: number; skipped: number; errors: number }>(
        '/customers/import-csv',
        formData,
      );
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
      const result = await api.post<{ created: number; updated: number }>(
        '/customers/import-from-conversations',
        { includeMessages },
      );
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
          <h2 className="text-lg font-serif font-semibold text-slate-900">
            {t('import.modal_title')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
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
              <p className="text-xs text-slate-600">
                {csvFile ? csvFile.name : t('import.csv_drop_zone')}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleCsvSelect(e.target.files[0])}
            />

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
              <button
                onClick={importCsv}
                disabled={csvImporting}
                className="bg-sage-600 text-white px-3 py-1.5 rounded-xl text-sm hover:bg-sage-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {csvImporting && <Loader2 size={14} className="animate-spin" />}
                {t('import.import_button')}
              </button>
            )}

            {csvResult && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                {t('import.csv_result', {
                  created: csvResult.created,
                  skipped: csvResult.skipped,
                  errors: csvResult.errors,
                })}
              </p>
            )}
          </div>

          <hr />

          {/* Conversation Import */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t('import.conversations_title')}</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMessages}
                onChange={(e) => setIncludeMessages(e.target.checked)}
                className="rounded text-lavender-600"
              />
              <span className="text-xs">{t('import.include_messages')}</span>
            </label>
            <button
              onClick={importFromConversations}
              disabled={convImporting}
              className="bg-lavender-600 text-white px-3 py-1.5 rounded-xl text-sm hover:bg-lavender-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {convImporting && <Loader2 size={14} className="animate-spin" />}
              {t('import.generate_profiles')}
            </button>
            {convResult && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                {t('import.conversations_result', {
                  created: convResult.created,
                  updated: convResult.updated,
                })}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 border-t flex justify-end">
          <button
            onClick={() => {
              onImported();
            }}
            className="bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
