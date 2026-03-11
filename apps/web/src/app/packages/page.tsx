'use client';

import { useEffect, useState, useCallback } from 'react';
import { Package, Plus, Users, DollarSign, BarChart3, Edit2, Trash2, Eye } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PACKAGE_STATUS_STYLES, packageBadgeClasses } from '@/lib/design-tokens';
import { PageSkeleton } from '@/components/skeleton';

interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  serviceId: string | null;
  totalSessions: number;
  price: string;
  currency: string;
  validityDays: number;
  isActive: boolean;
  memberOnly: boolean;
  allowedMembershipTiers: string[];
  service: { id: string; name: string } | null;
  _count: { purchases: number };
}

interface PackageStats {
  totalPackages: number;
  activePurchases: number;
  totalRevenue: number;
  totalRedemptions: number;
}

interface PackagePurchase {
  id: string;
  totalSessions: number;
  usedSessions: number;
  status: string;
  purchasedAt: string;
  expiresAt: string;
  package: { id: string; name: string; serviceId: string | null; service: { id: string; name: string } | null };
  customer: { id: string; name: string; phone: string };
  _count: { redemptions: number };
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [purchases, setPurchases] = useState<PackagePurchase[]>([]);
  const [stats, setStats] = useState<PackageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'packages' | 'purchases'>('packages');
  const [showCreate, setShowCreate] = useState(false);
  const [showPurchase, setShowPurchase] = useState<string | null>(null);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSessions, setFormSessions] = useState(10);
  const [formPrice, setFormPrice] = useState(0);
  const [formValidity, setFormValidity] = useState(365);
  const [formServiceId, setFormServiceId] = useState('');
  const [formMemberOnly, setFormMemberOnly] = useState(false);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);

  // Purchase form state
  const [purchaseCustomerId, setPurchaseCustomerId] = useState('');
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState('CASH');
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch('/packages'),
      apiFetch('/packages/stats'),
      apiFetch('/packages/purchases'),
      apiFetch('/services'),
      apiFetch('/customers'),
    ])
      .then(([pkgs, statsData, purchasesData, servicesData, customersData]) => {
        setPackages(pkgs);
        setStats(statsData);
        setPurchases(purchasesData);
        setServices(servicesData?.data || servicesData || []);
        setCustomers(Array.isArray(customersData) ? customersData : customersData?.data || []);
        setError('');
      })
      .catch((err) => setError(err.message || 'Failed to load packages'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormSessions(10);
    setFormPrice(0);
    setFormValidity(365);
    setFormServiceId('');
    setFormMemberOnly(false);
    setEditingPackage(null);
  };

  const openEdit = (pkg: ServicePackage) => {
    setEditingPackage(pkg);
    setFormName(pkg.name);
    setFormDescription(pkg.description || '');
    setFormSessions(pkg.totalSessions);
    setFormPrice(Number(pkg.price));
    setFormValidity(pkg.validityDays);
    setFormServiceId(pkg.serviceId || '');
    setFormMemberOnly(pkg.memberOnly);
    setShowCreate(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name: formName,
        description: formDescription || undefined,
        totalSessions: formSessions,
        price: formPrice,
        validityDays: formValidity,
        serviceId: formServiceId || undefined,
        memberOnly: formMemberOnly,
      };
      if (editingPackage) {
        await apiFetch(`/packages/${editingPackage.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/packages', { method: 'POST', body: JSON.stringify(body) });
      }
      setShowCreate(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package?')) return;
    try {
      await apiFetch(`/packages/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePurchase = async (packageId: string) => {
    if (!purchaseCustomerId) return;
    setSaving(true);
    try {
      await apiFetch(`/packages/${packageId}/purchase`, {
        method: 'POST',
        body: JSON.stringify({
          customerId: purchaseCustomerId,
          paymentMethod: purchasePaymentMethod,
        }),
      });
      setShowPurchase(null);
      setPurchaseCustomerId('');
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-page-fade">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lavender-50 flex items-center justify-center">
            <Package size={20} className="text-lavender-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Session Packages</h1>
            <p className="text-sm text-slate-500">Manage treatment packages and track sessions</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm font-medium transition-colors btn-press"
        >
          <Plus size={16} />
          New Package
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Packages', value: stats.totalPackages, icon: Package },
            { label: 'Active Purchases', value: stats.activePurchases, icon: Users },
            { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`, icon: DollarSign },
            { label: 'Sessions Redeemed', value: stats.totalRedemptions, icon: BarChart3 },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl shadow-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon size={16} className="text-slate-400" />
                <span className="text-xs text-slate-500">{stat.label}</span>
              </div>
              <p className="text-xl font-semibold text-slate-800 font-serif">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
        {(['packages', 'purchases'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'packages' ? 'Packages' : 'Purchases'}
          </button>
        ))}
      </div>

      {/* Packages List */}
      {tab === 'packages' && (
        <div className="space-y-3">
          {packages.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-soft p-12 text-center">
              <Package size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">No packages yet. Create your first session package.</p>
            </div>
          ) : (
            packages.map((pkg) => (
              <div key={pkg.id} className="bg-white rounded-2xl shadow-soft p-5 flex items-center justify-between" data-testid="package-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 truncate">{pkg.name}</h3>
                    {!pkg.isActive && (
                      <span className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded-full">Inactive</span>
                    )}
                    {pkg.memberOnly && (
                      <span className="px-2 py-0.5 text-[10px] bg-lavender-50 text-lavender-700 rounded-full">Members Only</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{pkg.totalSessions} sessions</span>
                    <span>${Number(pkg.price).toFixed(2)}</span>
                    {pkg.service && <span className="text-lavender-600">{pkg.service.name}</span>}
                    <span>{pkg.validityDays} day validity</span>
                    <span>{pkg._count.purchases} sold</span>
                  </div>
                  {pkg.description && (
                    <p className="text-xs text-slate-400 mt-1 truncate">{pkg.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setShowPurchase(pkg.id)}
                    className="p-2 hover:bg-sage-50 rounded-lg transition-colors"
                    title="Sell package"
                  >
                    <Users size={16} className="text-sage-600" />
                  </button>
                  <button
                    onClick={() => openEdit(pkg)}
                    className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} className="text-slate-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Purchases List */}
      {tab === 'purchases' && (
        <div className="space-y-3">
          {purchases.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-soft p-12 text-center">
              <Users size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">No package purchases yet.</p>
            </div>
          ) : (
            purchases.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl shadow-soft p-5" data-testid="purchase-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{p.customer.name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${packageBadgeClasses(p.status)}`}>
                      {PACKAGE_STATUS_STYLES[p.status]?.label || p.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Purchased {new Date(p.purchasedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{p.package.name}</span>
                  <span>{p.usedSessions} / {p.totalSessions} used</span>
                  <span>{p.totalSessions - p.usedSessions} remaining</span>
                  <span>Expires {new Date(p.expiresAt).toLocaleDateString()}</span>
                </div>
                {/* Mini progress bar */}
                <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sage-500 rounded-full transition-all"
                    style={{ width: `${p.totalSessions > 0 ? (p.usedSessions / p.totalSessions) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 animate-backdrop" onClick={() => { setShowCreate(false); resetForm(); }} />
          <div className="relative bg-white rounded-2xl shadow-soft-lg p-6 w-full max-w-md animate-modal-enter">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              {editingPackage ? 'Edit Package' : 'Create Package'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                  placeholder="10 Massage Sessions"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Description</label>
                <input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Sessions</label>
                  <input
                    type="number"
                    min={1}
                    value={formSessions}
                    onChange={(e) => setFormSessions(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Price ($)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Validity (days)</label>
                  <input
                    type="number"
                    min={1}
                    value={formValidity}
                    onChange={(e) => setFormValidity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Service (optional)</label>
                  <select
                    value={formServiceId}
                    onChange={(e) => setFormServiceId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                    aria-label="Service"
                  >
                    <option value="">Any service</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={formMemberOnly}
                  onChange={(e) => setFormMemberOnly(e.target.checked)}
                  className="rounded"
                />
                Members only
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setShowCreate(false); resetForm(); }}
                className="flex-1 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formName || formSessions < 1 || saving}
                className="flex-1 px-4 py-2 text-sm bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 btn-press"
              >
                {saving ? 'Saving...' : editingPackage ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Modal */}
      {showPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 animate-backdrop" onClick={() => setShowPurchase(null)} />
          <div className="relative bg-white rounded-2xl shadow-soft-lg p-6 w-full max-w-md animate-modal-enter">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Sell Package</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Customer</label>
                <select
                  value={purchaseCustomerId}
                  onChange={(e) => setPurchaseCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                  aria-label="Customer"
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Payment Method</label>
                <select
                  value={purchasePaymentMethod}
                  onChange={(e) => setPurchasePaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                  aria-label="Payment method"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="STRIPE">Stripe</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowPurchase(null)}
                className="flex-1 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePurchase(showPurchase)}
                disabled={!purchaseCustomerId || saving}
                className="flex-1 px-4 py-2 text-sm bg-sage-600 hover:bg-sage-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 btn-press"
              >
                {saving ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
