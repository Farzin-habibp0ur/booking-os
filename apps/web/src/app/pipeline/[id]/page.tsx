'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  ArrowLeft,
  Car,
  User,
  Clock,
  DollarSign,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  ChevronRight,
  Plus,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { PageSkeleton } from '@/components/skeleton';
import { DEAL_STAGE_STYLES, dealStageBadgeClasses } from '@/lib/design-tokens';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DealDetail {
  id: string;
  stage: string;
  dealValue: number | null;
  probability: number;
  source: string | null;
  dealType: string | null;
  tradeInValue: number | null;
  expectedCloseDate: string | null;
  actualCloseDate: string | null;
  lostReason: string | null;
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
  stageHistory: Array<{
    id: string;
    fromStage: string | null;
    toStage: string;
    duration: number | null;
    notes: string | null;
    createdAt: string;
    changedBy: { id: string; name: string } | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    description: string;
    scheduledFor: string | null;
    completedAt: string | null;
    createdAt: string;
    createdBy: { id: string; name: string } | null;
  }>;
}

const STAGES = ['INQUIRY', 'QUALIFIED', 'TEST_DRIVE', 'NEGOTIATION', 'FINANCE', 'CLOSED_WON', 'CLOSED_LOST'];
const ACTIVE_STAGES = ['INQUIRY', 'QUALIFIED', 'TEST_DRIVE', 'NEGOTIATION', 'FINANCE'];

const ACTIVITY_ICONS: Record<string, string> = {
  NOTE: '📝',
  CALL: '📞',
  EMAIL: '✉️',
  MEETING: '🤝',
  TEST_DRIVE: '🚗',
  FOLLOW_UP: '🔔',
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [editDealValue, setEditDealValue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editExpectedClose, setEditExpectedClose] = useState('');

  const loadDeal = useCallback(async () => {
    try {
      const data = await api.get<DealDetail>(`/deals/${dealId}`);
      setDeal(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    loadDeal();
  }, [loadDeal]);

  const startEditing = () => {
    if (!deal) return;
    setEditDealValue(deal.dealValue?.toString() || '');
    setEditNotes(deal.notes || '');
    setEditExpectedClose(deal.expectedCloseDate ? deal.expectedCloseDate.slice(0, 10) : '');
    setEditing(true);
  };

  const saveEdits = async () => {
    if (!deal) return;
    try {
      await api.patch(`/deals/${deal.id}`, {
        dealValue: editDealValue ? parseFloat(editDealValue) : undefined,
        notes: editNotes || undefined,
        expectedCloseDate: editExpectedClose || undefined,
      });
      setEditing(false);
      loadDeal();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageSkeleton />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-slate-500">Deal not found</p>
        <button
          onClick={() => router.push('/pipeline')}
          className="mt-4 text-sage-600 hover:underline text-sm"
        >
          Back to Pipeline
        </button>
      </div>
    );
  }

  const currentStageIdx = ACTIVE_STAGES.indexOf(deal.stage);
  const isClosed = deal.stage === 'CLOSED_WON' || deal.stage === 'CLOSED_LOST';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back + Header */}
      <button
        onClick={() => router.push('/pipeline')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={16} />
        Back to Pipeline
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
              {deal.customer.name}
            </h1>
            <span
              className={cn(
                'text-xs font-semibold px-2.5 py-1 rounded-lg',
                dealStageBadgeClasses(deal.stage),
              )}
            >
              {DEAL_STAGE_STYLES[deal.stage]?.label || deal.stage}
            </span>
          </div>
          {deal.vehicle && (
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <Car size={14} />
              {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
              {deal.vehicle.trim ? ` ${deal.vehicle.trim}` : ''} — #{deal.vehicle.stockNumber}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isClosed && (
            <button
              onClick={() => setShowStageModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm transition-colors"
            >
              <ChevronRight size={14} />
              Change Stage
            </button>
          )}
          {!editing ? (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Edit2 size={14} />
              Edit
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={saveEdits}
                className="flex items-center gap-1 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white rounded-xl text-sm transition-colors"
              >
                <Save size={14} />
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stage Progress Bar */}
      {!isClosed && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 mb-6">
          <div className="flex items-center gap-1">
            {ACTIVE_STAGES.map((stage, i) => {
              const style = DEAL_STAGE_STYLES[stage];
              const isActive = i <= currentStageIdx;
              const isCurrent = stage === deal.stage;
              return (
                <div key={stage} className="flex-1 flex flex-col items-center">
                  <div
                    className={cn(
                      'w-full h-2 rounded-full transition-colors',
                      isActive ? 'bg-sage-500' : 'bg-slate-100 dark:bg-slate-800',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] mt-1.5',
                      isCurrent
                        ? 'font-semibold text-sage-700'
                        : isActive
                          ? 'text-slate-600'
                          : 'text-slate-300',
                    )}
                  >
                    {style?.label || stage}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Closed banner */}
      {isClosed && (
        <div
          className={cn(
            'rounded-2xl p-4 mb-6',
            deal.stage === 'CLOSED_WON'
              ? 'bg-sage-50 border border-sage-200'
              : 'bg-red-50 border border-red-200',
          )}
        >
          <p
            className={cn(
              'text-sm font-semibold',
              deal.stage === 'CLOSED_WON' ? 'text-sage-900' : 'text-red-700',
            )}
          >
            {deal.stage === 'CLOSED_WON' ? 'Deal Won' : 'Deal Lost'}
            {deal.actualCloseDate && (
              <span className="font-normal ml-2">
                on {new Date(deal.actualCloseDate).toLocaleDateString()}
              </span>
            )}
          </p>
          {deal.lostReason && (
            <p className="text-sm text-red-600 mt-1">Reason: {deal.lostReason}</p>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details + Activities */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Details */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Deal Details
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400 text-xs">Deal Value</span>
                {editing ? (
                  <input
                    type="number"
                    value={editDealValue}
                    onChange={(e) => setEditDealValue(e.target.value)}
                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-2 py-1 text-sm mt-0.5"
                  />
                ) : (
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {deal.dealValue != null ? `$${deal.dealValue.toLocaleString()}` : '—'}
                  </p>
                )}
              </div>
              <div>
                <span className="text-slate-400 text-xs">Probability</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {deal.probability}%
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Deal Type</span>
                <p className="text-slate-700 dark:text-slate-300">
                  {deal.dealType?.replace(/_/g, ' ') || '—'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Source</span>
                <p className="text-slate-700 dark:text-slate-300">
                  {deal.source?.replace(/_/g, ' ') || '—'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Trade-In Value</span>
                <p className="text-slate-700 dark:text-slate-300">
                  {deal.tradeInValue != null
                    ? `$${deal.tradeInValue.toLocaleString()}`
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 text-xs">Expected Close</span>
                {editing ? (
                  <input
                    type="date"
                    value={editExpectedClose}
                    onChange={(e) => setEditExpectedClose(e.target.value)}
                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-2 py-1 text-sm mt-0.5"
                  />
                ) : (
                  <p className="text-slate-700 dark:text-slate-300">
                    {deal.expectedCloseDate
                      ? new Date(deal.expectedCloseDate).toLocaleDateString()
                      : '—'}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 text-xs">Notes</span>
                {editing ? (
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-2 py-1 text-sm mt-0.5 resize-none"
                  />
                ) : (
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {deal.notes || '—'}
                  </p>
                )}
              </div>
              <div>
                <span className="text-slate-400 text-xs">Created</span>
                <p className="text-slate-700 dark:text-slate-300">
                  {new Date(deal.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Activity
              </h2>
              <button
                onClick={() => setShowActivityModal(true)}
                className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-700"
              >
                <Plus size={12} />
                Add Activity
              </button>
            </div>

            {deal.activities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No activities yet
              </p>
            ) : (
              <div className="space-y-3">
                {deal.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex gap-3 text-sm border-l-2 border-slate-100 dark:border-slate-800 pl-3"
                  >
                    <span className="text-base shrink-0">
                      {ACTIVITY_ICONS[activity.type] || '📋'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 dark:text-slate-300">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        {activity.createdBy && <span>{activity.createdBy.name}</span>}
                        <span>
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </span>
                        {activity.type && (
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {activity.type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stage History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Stage History
            </h2>
            <div className="space-y-2">
              {deal.stageHistory.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {h.fromStage && (
                      <>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded',
                            dealStageBadgeClasses(h.fromStage),
                          )}
                        >
                          {DEAL_STAGE_STYLES[h.fromStage]?.label || h.fromStage}
                        </span>
                        <ChevronRight size={12} className="text-slate-300" />
                      </>
                    )}
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded',
                        dealStageBadgeClasses(h.toStage),
                      )}
                    >
                      {DEAL_STAGE_STYLES[h.toStage]?.label || h.toStage}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    {h.duration != null && <span>{Math.round(h.duration / 60)}h</span>}
                    {h.changedBy && <span>{h.changedBy.name}</span>}
                    <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Customer
            </h3>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {deal.customer.name}
              </p>
              {deal.customer.phone && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Phone size={12} />
                  {deal.customer.phone}
                </div>
              )}
              {deal.customer.email && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Mail size={12} />
                  {deal.customer.email}
                </div>
              )}
              <a
                href={`/customers/${deal.customer.id}`}
                className="block text-xs text-sage-600 hover:underline mt-2"
              >
                View Customer Profile →
              </a>
            </div>
          </div>

          {/* Vehicle Info */}
          {deal.vehicle && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Vehicle
              </h3>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
                </p>
                {deal.vehicle.trim && (
                  <p className="text-slate-500">{deal.vehicle.trim}</p>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Stock #</span>
                  <span className="font-mono text-slate-600">{deal.vehicle.stockNumber}</span>
                </div>
                {deal.vehicle.askingPrice != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Asking Price</span>
                    <span className="font-semibold">${deal.vehicle.askingPrice.toLocaleString()}</span>
                  </div>
                )}
                <a
                  href={`/inventory/${deal.vehicle.id}`}
                  className="block text-xs text-sage-600 hover:underline mt-2"
                >
                  View Vehicle →
                </a>
              </div>
            </div>
          )}

          {/* Salesperson */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Salesperson
            </h3>
            {deal.assignedTo ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sage-100 dark:bg-sage-900/30 flex items-center justify-center">
                  <User size={14} className="text-sage-600" />
                </div>
                <span className="text-sm text-slate-900 dark:text-slate-100">
                  {deal.assignedTo.name}
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Unassigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Stage Change Modal */}
      {showStageModal && (
        <StageChangeModal
          currentStage={deal.stage}
          onClose={() => setShowStageModal(false)}
          onChanged={() => {
            setShowStageModal(false);
            loadDeal();
          }}
          dealId={deal.id}
        />
      )}

      {/* Add Activity Modal */}
      {showActivityModal && (
        <AddActivityModal
          dealId={deal.id}
          onClose={() => setShowActivityModal(false)}
          onAdded={() => {
            setShowActivityModal(false);
            loadDeal();
          }}
        />
      )}
    </div>
  );
}

// ─── Stage Change Modal ─────────────────────────────────────────────────────

function StageChangeModal({
  currentStage,
  dealId,
  onClose,
  onChanged,
}: {
  currentStage: string;
  dealId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [stage, setStage] = useState('');
  const [notes, setNotes] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage) return;

    setSubmitting(true);
    try {
      await api.patch(`/deals/${dealId}/stage`, {
        stage,
        notes: notes || undefined,
        lostReason: stage === 'CLOSED_LOST' ? lostReason || undefined : undefined,
      });
      onChanged();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-soft-lg w-full max-w-md p-6 animate-modal-enter">
        <h2 className="text-lg font-serif font-semibold mb-4">Change Stage</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 mb-1 block">New Stage</label>
            <div className="grid grid-cols-2 gap-2">
              {STAGES.filter((s) => s !== currentStage).map((s) => {
                const style = DEAL_STAGE_STYLES[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStage(s)}
                    className={cn(
                      'text-xs px-3 py-2 rounded-xl border-2 transition-colors',
                      stage === s
                        ? 'border-sage-500 bg-sage-50'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100 dark:bg-slate-800',
                    )}
                  >
                    {style?.label || s}
                  </button>
                );
              })}
            </div>
          </div>

          {stage === 'CLOSED_LOST' && (
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Lost Reason</label>
              <textarea
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm resize-none"
                placeholder="Why was this deal lost?"
              />
            </div>
          )}

          <div>
            <label className="text-sm text-slate-600 mb-1 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!stage || submitting}
              className="px-4 py-2 text-sm bg-sage-600 hover:bg-sage-700 text-white rounded-xl disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Update Stage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Activity Modal ─────────────────────────────────────────────────────

function AddActivityModal({
  dealId,
  onClose,
  onAdded,
}: {
  dealId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [type, setType] = useState('NOTE');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/deals/${dealId}/activities`, { type, description });
      onAdded();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 animate-backdrop" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-soft-lg w-full max-w-md p-6 animate-modal-enter">
        <h2 className="text-lg font-serif font-semibold mb-4">Add Activity</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm"
            >
              <option value="NOTE">Note</option>
              <option value="CALL">Call</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">Meeting</option>
              <option value="TEST_DRIVE">Test Drive</option>
              <option value="FOLLOW_UP">Follow-Up</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm resize-none"
              placeholder="What happened?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!description.trim() || submitting}
              className="px-4 py-2 text-sm bg-sage-600 hover:bg-sage-700 text-white rounded-xl disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
