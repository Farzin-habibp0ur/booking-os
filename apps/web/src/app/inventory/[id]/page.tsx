'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageSkeleton } from '@/components/skeleton';
import {
  VEHICLE_STATUS_STYLES,
  vehicleStatusBadgeClasses,
  vehicleConditionBadgeClasses,
  VEHICLE_CONDITION_STYLES,
} from '@/lib/design-tokens';
import {
  ArrowLeft,
  Car,
  Gauge,
  MapPin,
  Calendar,
  User,
  Hash,
  DollarSign,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
  costPrice?: number | null;
  description?: string | null;
  features: string[];
  imageUrls: string[];
  createdAt: string;
  updatedAt: string;
  soldAt?: string | null;
  location?: { id: string; name: string } | null;
  addedBy?: { id: string; name: string } | null;
  testDrives: TestDrive[];
}

interface TestDrive {
  id: string;
  status: string;
  feedback?: string | null;
  notes?: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  staff?: { id: string; name: string } | null;
  booking?: { id: string; startTime: string; status: string } | null;
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [editingStatus, setEditingStatus] = useState(false);

  useEffect(() => {
    api
      .get(`/vehicles/${id}`)
      .then((v: any) => setVehicle(v))
      .catch(() => router.push('/inventory'))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleStatusChange(status: string) {
    try {
      const updated = await api.patch(`/vehicles/${id}`, { status });
      setVehicle((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditingStatus(false);
    } catch {
      // fail silently
    }
  }

  async function handleDelete() {
    if (!confirm('Archive this vehicle? It can be restored later.')) return;
    try {
      await api.delete(`/vehicles/${id}`);
      router.push('/inventory');
    } catch {
      // fail silently
    }
  }

  if (loading || !vehicle) return <PageSkeleton />;

  const daysOnLot = Math.floor(
    (Date.now() - new Date(vehicle.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const profit =
    vehicle.askingPrice != null && vehicle.costPrice != null
      ? Number(vehicle.askingPrice) - Number(vehicle.costPrice)
      : null;

  return (
    <div className="p-4 sm:p-6 animate-page-fade">
      {/* Back */}
      <button
        onClick={() => router.push('/inventory')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={16} />
        Back to Inventory
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Photos + Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photo Gallery */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden">
            <div className="relative h-64 sm:h-80 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              {vehicle.imageUrls.length > 0 ? (
                <>
                  <img
                    src={vehicle.imageUrls[photoIdx]}
                    alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    className="w-full h-full object-cover"
                  />
                  {vehicle.imageUrls.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setPhotoIdx((i) => (i - 1 + vehicle.imageUrls.length) % vehicle.imageUrls.length)
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => setPhotoIdx((i) => (i + 1) % vehicle.imageUrls.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full"
                      >
                        <ChevronRight size={18} />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {vehicle.imageUrls.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setPhotoIdx(i)}
                            className={`w-2 h-2 rounded-full ${i === photoIdx ? 'bg-white' : 'bg-white/40'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <Car size={48} className="text-slate-300 dark:text-slate-600" />
              )}
            </div>
          </div>

          {/* Title + Status */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                  {vehicle.trim && (
                    <span className="font-normal text-slate-400 ml-2">{vehicle.trim}</span>
                  )}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-slate-400 font-mono">{vehicle.stockNumber}</span>
                  {vehicle.vin && (
                    <span className="text-xs text-slate-400 font-mono">VIN: {vehicle.vin}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/inventory/${vehicle.id}`)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  title="Edit"
                >
                  <Edit2 size={16} className="text-slate-400" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 hover:bg-red-50 rounded-xl"
                  title="Archive"
                >
                  <Trash2 size={16} className="text-red-400" />
                </button>
              </div>
            </div>

            {/* Status + Condition badges */}
            <div className="flex items-center gap-2 mt-3">
              {editingStatus ? (
                <select
                  value={vehicle.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  onBlur={() => setEditingStatus(false)}
                  autoFocus
                  className="text-xs rounded-full border-slate-200 px-2 py-1"
                  aria-label="Change vehicle status"
                >
                  {Object.entries(VEHICLE_STATUS_STYLES).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={() => setEditingStatus(true)}
                  className={`text-xs px-3 py-1 rounded-full font-medium ${vehicleStatusBadgeClasses(vehicle.status)}`}
                >
                  {VEHICLE_STATUS_STYLES[vehicle.status]?.label || vehicle.status}
                </button>
              )}
              <span
                className={`text-xs px-3 py-1 rounded-full font-medium ${vehicleConditionBadgeClasses(vehicle.condition)}`}
              >
                {VEHICLE_CONDITION_STYLES[vehicle.condition]?.label || vehicle.condition}
              </span>
            </div>

            {/* Description */}
            {vehicle.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">{vehicle.description}</p>
            )}

            {/* Features */}
            {vehicle.features.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Features
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {vehicle.features.map((f, i) => (
                    <span
                      key={i}
                      className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Test Drive History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Test Drives ({vehicle.testDrives.length})
            </h2>
            {vehicle.testDrives.length === 0 ? (
              <p className="text-sm text-slate-400">No test drives recorded.</p>
            ) : (
              <div className="space-y-3">
                {vehicle.testDrives.map((td) => (
                  <div
                    key={td.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {td.customer.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(td.createdAt).toLocaleDateString()}
                        {td.staff && ` — ${td.staff.name}`}
                      </p>
                      {td.feedback && (
                        <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{td.feedback}&rdquo;</p>
                      )}
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        td.status === 'COMPLETED'
                          ? 'bg-sage-50 text-sage-700'
                          : td.status === 'NO_SHOW'
                            ? 'bg-red-50 text-red-700'
                            : td.status === 'CANCELLED'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-lavender-50 text-lavender-700'
                      }`}
                    >
                      {td.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Pricing */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Pricing
            </h2>
            {vehicle.askingPrice != null && (
              <div className="mb-2">
                <p className="text-xs text-slate-500">Asking Price</p>
                <p className="text-2xl font-serif font-bold text-slate-900 dark:text-slate-100">
                  ${Number(vehicle.askingPrice).toLocaleString()}
                </p>
              </div>
            )}
            {vehicle.costPrice != null && (
              <div className="mb-2">
                <p className="text-xs text-slate-500">Cost</p>
                <p className="text-sm text-slate-600">${Number(vehicle.costPrice).toLocaleString()}</p>
              </div>
            )}
            {profit != null && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500">Potential Profit</p>
                <p
                  className={`text-sm font-semibold ${profit >= 0 ? 'text-sage-600' : 'text-red-600'}`}
                >
                  {profit >= 0 ? '+' : '-'}${Math.abs(profit).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Specs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Specifications
            </h2>
            <dl className="space-y-2.5">
              {[
                { icon: Gauge, label: 'Mileage', value: vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} mi` : null },
                { icon: Car, label: 'Color', value: vehicle.color },
                { icon: MapPin, label: 'Location', value: vehicle.location?.name },
                { icon: Calendar, label: 'Days on Lot', value: `${daysOnLot} days` },
                { icon: User, label: 'Added By', value: vehicle.addedBy?.name },
                { icon: Calendar, label: 'Added', value: new Date(vehicle.createdAt).toLocaleDateString() },
              ]
                .filter((item) => item.value)
                .map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
                    <item.icon size={14} className="text-slate-400 shrink-0" />
                    <span className="text-slate-500">{item.label}:</span>
                    <span className="text-slate-900 dark:text-slate-100 ml-auto">{item.value}</span>
                  </div>
                ))}
            </dl>
            {vehicle.soldAt && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500">
                  Sold on {new Date(vehicle.soldAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
