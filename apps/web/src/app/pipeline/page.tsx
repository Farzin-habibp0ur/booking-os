'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import {
  Compass,
  RefreshCw,
  User,
  Clock,
  Car,
  Filter,
  DollarSign,
  Plus,
  Search,
} from 'lucide-react';
import { PageSkeleton } from '@/components/skeleton';
import { PipelineStats } from '@/components/dealership/pipeline-stats';
import { DEAL_STAGE_STYLES, dealStageBadgeClasses } from '@/lib/design-tokens';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DealCard {
  id: string;
  stage: string;
  dealValue: number | null;
  probability: number;
  source: string | null;
  dealType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; phone: string; email: string | null };
  vehicle: {
    id: string;
    stockNumber: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    askingPrice: number | null;
    status: string;
  } | null;
  assignedTo: { id: string; name: string } | null;
  _count: { activities: number };
}

interface PipelineData {
  stages: Record<string, DealCard[]>;
  stageTotals: Record<string, { count: number; value: number }>;
  totalDeals: number;
}

interface StatsData {
  totalDeals: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  winRate: number;
  avgCycleTime: number;
  won: number;
  lost: number;
}

const PIPELINE_COLUMNS = [
  { stage: 'INQUIRY', label: 'Inquiry' },
  { stage: 'QUALIFIED', label: 'Qualified' },
  { stage: 'TEST_DRIVE', label: 'Test Drive' },
  { stage: 'NEGOTIATION', label: 'Negotiation' },
  { stage: 'FINANCE', label: 'Finance' },
];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [staffFilter, setStaffFilter] = useState('');
  const [staff, setStaff] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewDealModal, setShowNewDealModal] = useState(false);

  const loadPipeline = useCallback(async () => {
    try {
      const data = await api.get<PipelineData>('/deals/pipeline');
      setPipeline(data);
    } catch {
      // ignore
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.get<StatsData>('/deals/stats');
      setStats(data);
    } catch {
      // ignore
    }
  }, []);

  const loadStaff = useCallback(async () => {
    try {
      const data = await api.get<any>('/staff');
      setStaff(Array.isArray(data) ? data : data?.data || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPipeline(), loadStats(), loadStaff()]).finally(() =>
      setLoading(false),
    );
  }, [loadPipeline, loadStats, loadStaff]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadPipeline, 30000);
    return () => clearInterval(interval);
  }, [loadPipeline]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPipeline(), loadStats()]);
    setRefreshing(false);
  };

  const handleDragStart = (dealId: string) => {
    setDragItem(dealId);
  };

  const handleDragOver = (e: React.DragEvent, colStage: string) => {
    e.preventDefault();
    setDragOverCol(colStage);
  };

  const handleDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragItem) return;

    // Find the deal in pipeline
    let deal: DealCard | undefined;
    if (pipeline) {
      for (const deals of Object.values(pipeline.stages)) {
        deal = deals.find((d) => d.id === dragItem);
        if (deal) break;
      }
    }

    if (!deal || deal.stage === targetStage) {
      setDragItem(null);
      return;
    }

    // Optimistic update
    if (pipeline) {
      const updated = { ...pipeline, stages: { ...pipeline.stages } };
      // Remove from old stage
      updated.stages[deal.stage] = updated.stages[deal.stage].filter(
        (d) => d.id !== dragItem,
      );
      // Add to new stage
      const movedDeal = { ...deal, stage: targetStage };
      updated.stages[targetStage] = [movedDeal, ...(updated.stages[targetStage] || [])];
      setPipeline(updated);
    }
    setDragItem(null);

    try {
      await api.patch(`/deals/${dragItem}/stage`, { stage: targetStage });
      loadStats();
    } catch {
      // Revert on failure
      loadPipeline();
    }
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverCol(null);
  };

  const getColumnDeals = (stage: string): DealCard[] => {
    if (!pipeline) return [];
    let deals = pipeline.stages[stage] || [];
    if (staffFilter) {
      deals = deals.filter((d) => d.assignedTo?.id === staffFilter);
    }
    return deals;
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
            Sales Pipeline
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pipeline?.totalDeals || 0} active deal
            {pipeline?.totalDeals !== 1 ? 's' : ''} in pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Staff Filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400" />
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
              aria-label="Filter by salesperson"
            >
              <option value="">All Salespeople</option>
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowNewDealModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm transition-colors"
          >
            <Plus size={14} />
            New Deal
          </button>
        </div>
      </div>

      {/* Pipeline Stats */}
      <PipelineStats stats={stats} />

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-w-[1200px] h-full pb-4">
          {PIPELINE_COLUMNS.map((col) => {
            const colDeals = getColumnDeals(col.stage);
            const stageStyle = DEAL_STAGE_STYLES[col.stage];
            const total = pipeline?.stageTotals[col.stage];

            return (
              <div
                key={col.stage}
                className={cn(
                  'flex-1 min-w-[220px] flex flex-col rounded-2xl transition-colors',
                  dragOverCol === col.stage
                    ? 'bg-sage-50/50 dark:bg-sage-900/10 ring-2 ring-sage-300'
                    : 'bg-slate-50/50 dark:bg-slate-800/30',
                )}
                onDragOver={(e) => handleDragOver(e, col.stage)}
                onDrop={(e) => handleDrop(e, col.stage)}
                onDragLeave={() => setDragOverCol(null)}
              >
                {/* Column Header */}
                <div className="p-3 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-1 rounded-lg',
                        stageStyle ? `${stageStyle.bg} ${stageStyle.text}` : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {col.label}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {colDeals.length}
                    </span>
                  </div>
                  {total && total.value > 0 && (
                    <p className="text-[10px] text-slate-400 px-1">
                      ${total.value.toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
                  {colDeals.length === 0 ? (
                    <div className="text-center py-8 text-slate-300 text-xs">
                      No deals
                    </div>
                  ) : (
                    colDeals.map((deal) => (
                      <DealKanbanCard
                        key={deal.id}
                        deal={deal}
                        onDragStart={() => handleDragStart(deal.id)}
                        onDragEnd={handleDragEnd}
                        isDragging={dragItem === deal.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Deal Modal */}
      {showNewDealModal && (
        <NewDealModal
          staff={staff}
          onClose={() => setShowNewDealModal(false)}
          onCreated={() => {
            setShowNewDealModal(false);
            loadPipeline();
            loadStats();
          }}
        />
      )}
    </div>
  );
}

// ─── Deal Kanban Card ───────────────────────────────────────────────────────

function DealKanbanCard({
  deal,
  onDragStart,
  onDragEnd,
  isDragging,
}: {
  deal: DealCard;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <a
      href={`/pipeline/${deal.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'block bg-white dark:bg-slate-900 rounded-xl shadow-soft p-3 cursor-grab active:cursor-grabbing transition-opacity border border-transparent hover:border-slate-200 dark:hover:border-slate-700',
        isDragging && 'opacity-50',
      )}
    >
      {/* Customer Name */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {deal.customer.name}
        </span>
        {deal.dealValue != null && deal.dealValue > 0 && (
          <span className="text-xs font-semibold text-sage-700 dark:text-sage-400 shrink-0 ml-1">
            ${deal.dealValue.toLocaleString()}
          </span>
        )}
      </div>

      {/* Vehicle Info */}
      {deal.vehicle && (
        <div className="flex items-center gap-1 mb-1.5">
          <Car size={12} className="text-slate-400 shrink-0" />
          <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
            {deal.vehicle.trim ? ` ${deal.vehicle.trim}` : ''}
          </span>
        </div>
      )}

      {/* Bottom row: Salesperson + Days in stage */}
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        {deal.assignedTo ? (
          <div className="flex items-center gap-1">
            <User size={10} />
            <span className="truncate">{deal.assignedTo.name}</span>
          </div>
        ) : (
          <span className="text-slate-300">Unassigned</span>
        )}
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>
            {daysInStage}d
          </span>
        </div>
      </div>

      {/* Probability bar */}
      <div className="mt-2 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-sage-500 rounded-full transition-all"
          style={{ width: `${deal.probability}%` }}
        />
      </div>
    </a>
  );
}

// ─── New Deal Modal ─────────────────────────────────────────────────────────

function NewDealModal({
  staff,
  onClose,
  onCreated,
}: {
  staff: any[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [source, setSource] = useState('');
  const [dealType, setDealType] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Customer search
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Vehicle search
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomers([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await api.get<any>(`/customers?search=${encodeURIComponent(customerSearch)}&take=10`);
        setCustomers(Array.isArray(data) ? data : data?.data || []);
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<any>('/vehicles?status=IN_STOCK&take=50');
        setVehicles(Array.isArray(data) ? data : data?.data || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setError('Please select a customer');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await api.post('/deals', {
        customerId,
        vehicleId: vehicleId || undefined,
        assignedToId: assignedToId || undefined,
        dealValue: dealValue ? parseFloat(dealValue) : undefined,
        source: source || undefined,
        dealType: dealType || undefined,
        notes: notes || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-soft-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-modal-enter">
        <h2 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-100 mb-4">
          New Deal
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Search */}
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
              Customer *
            </label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                <span className="text-sm">{selectedCustomer.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerId('');
                    setCustomerSearch('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customers..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl text-sm"
                />
                {customers.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-800 rounded-xl shadow-soft-sm border border-slate-100 dark:border-slate-700 max-h-40 overflow-y-auto z-10">
                    {customers.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerId(c.id);
                          setCustomers([]);
                          setCustomerSearch('');
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        {c.name}
                        {c.phone && (
                          <span className="text-xs text-slate-400 ml-2">{c.phone}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vehicle */}
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
              Vehicle
            </label>
            <select
              value={vehicleId}
              onChange={(e) => {
                setVehicleId(e.target.value);
                setSelectedVehicle(vehicles.find((v: any) => v.id === e.target.value) || null);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Select vehicle...</option>
              {vehicles.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.year} {v.make} {v.model} {v.trim || ''} — #{v.stockNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned To */}
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
              Salesperson
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Assign later...</option>
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Deal Value + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
                Deal Value ($)
              </label>
              <input
                type="number"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                placeholder="0"
                min="0"
                step="100"
                className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
                Deal Type
              </label>
              <select
                value={dealType}
                onChange={(e) => setDealType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                <option value="NEW_PURCHASE">New Purchase</option>
                <option value="USED_PURCHASE">Used Purchase</option>
                <option value="TRADE_IN">Trade-In</option>
                <option value="LEASE">Lease</option>
              </select>
            </div>
          </div>

          {/* Source */}
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
              Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
            >
              <option value="">Select...</option>
              <option value="WALK_IN">Walk-In</option>
              <option value="PHONE">Phone</option>
              <option value="WEBSITE">Website</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="REFERRAL">Referral</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-sage-600 hover:bg-sage-700 text-white rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
