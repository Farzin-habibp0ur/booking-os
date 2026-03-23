'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageSkeleton, EmptyState } from '@/components/skeleton';
import { VehicleCard } from '@/components/dealership/vehicle-card';
import {
  VEHICLE_STATUS_STYLES,
  VEHICLE_CONDITION_STYLES,
  vehicleStatusBadgeClasses,
} from '@/lib/design-tokens';
import {
  Car,
  Plus,
  Search,
  Grid3X3,
  List,
  Filter,
  X,
  DollarSign,
  Package,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface Vehicle {
  id: string;
  stockNumber: string;
  vin?: string | null;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  color?: string | null;
  mileage?: number | null;
  condition: string;
  status: string;
  askingPrice?: number | null;
  imageUrls: string[];
  createdAt: string;
  location?: { name: string } | null;
  _count?: { testDrives: number };
}

interface Stats {
  total: number;
  countByStatus: Record<string, number>;
  totalValue: number;
  avgDaysOnLot: number;
}

export default function InventoryPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchVehicles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (conditionFilter) params.set('condition', conditionFilter);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('take', '50');

      const [res, statsRes] = await Promise.all([
        api.get<{ data: Vehicle[]; total: number }>(`/vehicles?${params.toString()}`),
        api.get<Stats>('/vehicles/stats'),
      ]);
      setVehicles(res.data || []);
      setTotal(res.total || 0);
      setStats(statsRes);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, conditionFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-4 sm:p-6 animate-page-fade">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
            Inventory
          </h1>
          <p className="text-sm text-slate-500 mt-1">{total} vehicles</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors btn-press"
        >
          <Plus size={16} />
          Add Vehicle
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Package size={14} />
              In Stock
            </div>
            <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
              {stats.countByStatus['IN_STOCK'] || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <DollarSign size={14} />
              Total Value
            </div>
            <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
              ${stats.totalValue.toLocaleString()}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <Clock size={14} />
              Avg Days on Lot
            </div>
            <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
              {stats.avgDaysOnLot}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
              <TrendingUp size={14} />
              Sold
            </div>
            <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
              {stats.countByStatus['SOLD'] || 0}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by make, model, stock #, VIN..."
            data-search-input
            className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl pl-9 pr-3 py-2.5 text-sm"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm border transition-colors',
            showFilters
              ? 'bg-sage-50 border-sage-200 text-sage-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600',
          )}
        >
          <Filter size={14} />
          Filters
          {(statusFilter || conditionFilter) && (
            <span className="w-1.5 h-1.5 rounded-full bg-sage-500" />
          )}
        </button>

        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
          <button
            onClick={() => setView('grid')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              view === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-400',
            )}
          >
            <Grid3X3 size={14} />
          </button>
          <button
            onClick={() => setView('table')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              view === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-400',
            )}
          >
            <List size={14} />
          </button>
        </div>

        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [sb, so] = e.target.value.split('-');
            setSortBy(sb);
            setSortOrder(so as 'asc' | 'desc');
          }}
          className="bg-slate-50 dark:bg-slate-800 border-transparent focus:ring-sage-500 rounded-xl text-sm py-2.5 px-3"
          aria-label="Sort vehicles"
        >
          <option value="createdAt-desc">Newest First</option>
          <option value="createdAt-asc">Oldest First</option>
          <option value="askingPrice-asc">Price: Low to High</option>
          <option value="askingPrice-desc">Price: High to Low</option>
          <option value="year-desc">Year: Newest</option>
          <option value="year-asc">Year: Oldest</option>
          <option value="mileage-asc">Mileage: Low to High</option>
          <option value="mileage-desc">Mileage: High to Low</option>
        </select>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl animate-slide-up">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-sm py-2 px-3"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {Object.entries(VEHICLE_STATUS_STYLES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>

          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl text-sm py-2 px-3"
            aria-label="Filter by condition"
          >
            <option value="">All Conditions</option>
            {Object.entries(VEHICLE_CONDITION_STYLES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>

          {(statusFilter || conditionFilter) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setConditionFilter('');
              }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Vehicle Grid/Table */}
      {vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles in inventory"
          description="Add your first vehicle to start managing your dealership inventory."
          action={{ label: 'Add Vehicle', onClick: () => setShowAddModal(true) }}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vehicles.map((v) => (
            <VehicleCard key={v.id} vehicle={v} onClick={() => router.push(`/inventory/${v.id}`)} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Stock #
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Condition
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Mileage
                </th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => router.push(`/inventory/${v.id}`)}
                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Car size={14} className="text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {v.year} {v.make} {v.model}
                      </span>
                      {v.trim && <span className="text-slate-400">{v.trim}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{v.stockNumber}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs">
                      {v.condition === 'CERTIFIED_PRE_OWNED' ? 'CPO' : v.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${vehicleStatusBadgeClasses(v.status)}`}
                    >
                      {VEHICLE_STATUS_STYLES[v.status]?.label || v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                    {v.askingPrice != null ? `$${Number(v.askingPrice).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {v.mileage != null ? `${v.mileage.toLocaleString()} mi` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <AddVehicleModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            fetchVehicles();
          }}
        />
      )}
    </div>
  );
}

// ─── Add Vehicle Modal ─────────────────────────────────────────────────────

function AddVehicleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    year: new Date().getFullYear(),
    make: '',
    model: '',
    trim: '',
    vin: '',
    color: '',
    mileage: '',
    condition: 'NEW',
    askingPrice: '',
    costPrice: '',
    description: '',
    stockNumber: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.make || !form.model) return;

    setSaving(true);
    setError('');
    try {
      await api.post('/vehicles', {
        year: form.year,
        make: form.make,
        model: form.model,
        trim: form.trim || undefined,
        vin: form.vin || undefined,
        color: form.color || undefined,
        mileage: form.mileage ? parseInt(form.mileage) : undefined,
        condition: form.condition,
        askingPrice: form.askingPrice ? parseFloat(form.askingPrice) : undefined,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        description: form.description || undefined,
        stockNumber: form.stockNumber || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to add vehicle');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-soft-lg w-full max-w-lg max-h-[90vh] overflow-y-auto animate-modal-enter">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold text-slate-900 dark:text-slate-100">
              Add Vehicle
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
              <X size={18} className="text-slate-400" />
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-xl mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Year *</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Make *</label>
                <input
                  type="text"
                  value={form.make}
                  onChange={(e) => setForm({ ...form, make: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Model *</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Trim</label>
                <input
                  type="text"
                  value={form.trim}
                  onChange={(e) => setForm({ ...form, trim: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Color</label>
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">VIN</label>
              <input
                type="text"
                value={form.vin}
                onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase() })}
                maxLength={17}
                placeholder="17-character VIN"
                className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Stock Number</label>
                <input
                  type="text"
                  value={form.stockNumber}
                  onChange={(e) => setForm({ ...form, stockNumber: e.target.value })}
                  placeholder="Auto-generated if empty"
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Mileage</label>
                <input
                  type="number"
                  value={form.mileage}
                  onChange={(e) => setForm({ ...form, mileage: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Condition</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                className="w-full bg-slate-50 border-transparent focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
              >
                <option value="NEW">New</option>
                <option value="USED">Used</option>
                <option value="CERTIFIED_PRE_OWNED">Certified Pre-Owned</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Asking Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.askingPrice}
                  onChange={(e) => setForm({ ...form, askingPrice: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Cost Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.make || !form.model}
                className="px-4 py-2.5 text-sm font-medium bg-sage-600 hover:bg-sage-700 text-white rounded-xl transition-colors disabled:opacity-50 btn-press"
              >
                {saving ? 'Adding...' : 'Add Vehicle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
