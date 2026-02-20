'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ChevronRight, Play, Pause, RotateCcw, FastForward, Pin, X, Users } from 'lucide-react';

interface PackVersion {
  id: string;
  version: number;
  isPublished: boolean;
  rolloutStage: string;
  rolloutPercent: number;
  rolloutStartedAt: string | null;
  rolloutCompletedAt: string | null;
  rolloutPausedAt: string | null;
  rolledBackAt: string | null;
  rolledBackReason: string | null;
  config: any;
  createdAt: string;
  updatedAt: string;
}

interface PackDetail {
  slug: string;
  name: string;
  description: string | null;
  versions: PackVersion[];
  businessCount: number;
  totalBusinesses: number;
  adoptionPercent: number;
  pinnedCount: number;
}

interface PinnedBusiness {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  packSlug: string;
  pinnedVersion: number;
  reason: string;
  pinnedBy: { id: string; name: string; email: string };
  createdAt: string;
}

const stageColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  published: 'bg-sage-50 text-sage-700 dark:bg-sage-900/20 dark:text-sage-400',
  rolling_out: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  paused: 'bg-lavender-50 text-lavender-700 dark:bg-lavender-900/20 dark:text-lavender-400',
  completed: 'bg-sage-50 text-sage-700 dark:bg-sage-900/20 dark:text-sage-400',
  rolled_back: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

function stageLabel(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLLOUT_STAGES = [5, 25, 50, 100];

export default function PackDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [detail, setDetail] = useState<PackDetail | null>(null);
  const [pins, setPins] = useState<PinnedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRollbackModal, setShowRollbackModal] = useState<PackVersion | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const [packData, pinsData] = await Promise.all([
        api.get<PackDetail>(`/admin/packs-console/${slug}/detail`),
        api.get<PinnedBusiness[]>(`/admin/packs-console/${slug}/pins`),
      ]);
      setDetail(packData);
      setPins(pinsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load pack detail');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRolloutAdvance = async (version: PackVersion, targetPercent: number) => {
    setActionLoading(true);
    try {
      await api.post(`/admin/packs-console/${slug}/versions/${version.version}/rollout`, {
        targetPercent,
      });
      await fetchDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to advance rollout');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async (version: PackVersion) => {
    setActionLoading(true);
    try {
      await api.post(`/admin/packs-console/${slug}/versions/${version.version}/pause`);
      await fetchDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to pause rollout');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (version: PackVersion) => {
    setActionLoading(true);
    try {
      await api.post(`/admin/packs-console/${slug}/versions/${version.version}/resume`);
      await fetchDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to resume rollout');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnpin = async (businessId: string) => {
    try {
      await api.del(`/admin/packs-console/${slug}/pins/${businessId}`);
      await fetchDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to unpin business');
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl" data-testid="pack-detail-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48" />
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-32" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="p-6 md:p-8 max-w-5xl">
        <nav className="flex items-center gap-1 text-sm text-slate-500 mb-4">
          <Link href="/console/packs" className="hover:text-slate-700">
            Packs & Skills
          </Link>
          <ChevronRight size={14} />
          <span className="text-slate-900 dark:text-white font-medium">{slug}</span>
        </nav>
        <div
          className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 text-red-700 dark:text-red-400"
          data-testid="pack-detail-error"
        >
          {error}
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const activeVersion = detail.versions.find(
    (v) => v.rolloutStage === 'rolling_out' || v.rolloutStage === 'paused',
  );

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-slate-500 mb-4" data-testid="breadcrumb">
        <Link href="/console/packs" className="hover:text-slate-700">
          Packs & Skills
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 dark:text-white font-medium">{detail.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
            {detail.name}
          </h1>
          {detail.description && (
            <p className="text-sm text-slate-500 mt-1">{detail.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="flex items-center gap-1">
            <Users size={14} />
            <span>
              {detail.businessCount} / {detail.totalBusinesses} businesses ({detail.adoptionPercent}
              %)
            </span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 text-red-700 dark:text-red-400 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Rollout Control Panel */}
      {activeVersion && (
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 mb-6"
          data-testid="rollout-panel"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Rollout — v{activeVersion.version}
          </h2>

          {/* Progress bar with staged markers */}
          <div className="relative mb-4" data-testid="rollout-progress">
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  activeVersion.rolloutStage === 'paused' ? 'bg-lavender-500' : 'bg-sage-500'
                }`}
                style={{ width: `${activeVersion.rolloutPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              {ROLLOUT_STAGES.map((pct) => (
                <span
                  key={pct}
                  className={`text-xs ${
                    activeVersion.rolloutPercent >= pct
                      ? 'text-sage-600 font-medium'
                      : 'text-slate-400'
                  }`}
                >
                  {pct}%
                </span>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {activeVersion.rolloutStage === 'rolling_out' && (
              <>
                {ROLLOUT_STAGES.filter((pct) => pct > activeVersion.rolloutPercent)
                  .slice(0, 1)
                  .map((nextPct) => (
                    <button
                      key={nextPct}
                      onClick={() => handleRolloutAdvance(activeVersion, nextPct)}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                      data-testid="advance-rollout"
                    >
                      <FastForward size={12} />
                      Advance to {nextPct}%
                    </button>
                  ))}
                <button
                  onClick={() => handlePause(activeVersion)}
                  disabled={actionLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                  data-testid="pause-rollout"
                >
                  <Pause size={12} />
                  Pause
                </button>
              </>
            )}
            {activeVersion.rolloutStage === 'paused' && (
              <button
                onClick={() => handleResume(activeVersion)}
                disabled={actionLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                data-testid="resume-rollout"
              >
                <Play size={12} />
                Resume
              </button>
            )}
            <button
              onClick={() => setShowRollbackModal(activeVersion)}
              disabled={actionLoading}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
              data-testid="rollback-btn"
            >
              <RotateCcw size={12} />
              Rollback
            </button>
          </div>
        </div>
      )}

      {/* Version History */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden mb-6"
        data-testid="version-table"
      >
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Version History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                <th className="px-5 py-3">Version</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Rollout %</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {detail.versions.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                  data-testid={`version-row-${v.version}`}
                >
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                    v{v.version}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${stageColors[v.rolloutStage] || stageColors.draft}`}
                    >
                      {stageLabel(v.rolloutStage)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                    {v.rolloutPercent}%
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      {v.rolloutStage === 'published' && (
                        <button
                          onClick={() => handleRolloutAdvance(v, 5)}
                          disabled={actionLoading}
                          className="text-xs text-sage-600 hover:text-sage-700 font-medium disabled:opacity-50"
                          data-testid={`start-rollout-${v.version}`}
                        >
                          Start Rollout
                        </button>
                      )}
                      {(v.rolloutStage === 'rolling_out' ||
                        v.rolloutStage === 'paused' ||
                        v.rolloutStage === 'completed') && (
                        <button
                          onClick={() => setShowRollbackModal(v)}
                          disabled={actionLoading}
                          className="text-xs text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                        >
                          Rollback
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pinned Tenants */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden mb-6"
        data-testid="pinned-tenants"
      >
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Pinned Tenants ({pins.length})
          </h2>
          <button
            onClick={() => setShowPinModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white text-xs font-medium rounded-xl transition-colors"
            data-testid="pin-business-btn"
          >
            <Pin size={12} />
            Pin Business
          </button>
        </div>
        {pins.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm text-slate-400" data-testid="no-pins">
            No businesses pinned to a specific version
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="px-5 py-3">Business</th>
                  <th className="px-5 py-3">Pinned Version</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Pinned By</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pins.map((pin) => (
                  <tr
                    key={pin.id}
                    className="border-b border-slate-50 dark:border-slate-800/50 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                      {pin.businessName}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      v{pin.pinnedVersion}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs max-w-xs truncate">
                      {pin.reason}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{pin.pinnedBy.name}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(pin.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleUnpin(pin.businessId)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium"
                        data-testid={`unpin-${pin.businessId}`}
                      >
                        Unpin
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Config Viewer */}
      {detail.versions[0] && (
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden"
          data-testid="config-viewer"
        >
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800"
            data-testid="toggle-config"
          >
            <span>Config — v{detail.versions[0].version}</span>
            <ChevronRight
              size={14}
              className={`transition-transform ${showConfig ? 'rotate-90' : ''}`}
            />
          </button>
          {showConfig && (
            <pre className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400 overflow-x-auto max-h-96">
              {JSON.stringify(detail.versions[0].config, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Rollback Modal */}
      {showRollbackModal && (
        <RollbackModal
          slug={slug}
          version={showRollbackModal}
          onClose={() => setShowRollbackModal(null)}
          onSuccess={() => {
            setShowRollbackModal(null);
            fetchDetail();
          }}
        />
      )}

      {/* Pin Modal */}
      {showPinModal && (
        <PinModal
          slug={slug}
          versions={detail.versions}
          onClose={() => setShowPinModal(false)}
          onSuccess={() => {
            setShowPinModal(false);
            fetchDetail();
          }}
        />
      )}
    </div>
  );
}

function RollbackModal({
  slug,
  version,
  onClose,
  onSuccess,
}: {
  slug: string;
  version: PackVersion;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/packs-console/${slug}/versions/${version.version}/rollback`, {
        reason,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to rollback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      data-testid="rollback-modal"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Rollback v{version.version}
          </h2>
          <button onClick={onClose} data-testid="modal-close">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          This will mark version {version.version} as rolled back. Provide a reason for the
          rollback.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for rollback..."
            className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 rounded-xl p-3 text-sm resize-none h-24"
            data-testid="rollback-reason"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              data-testid="confirm-rollback"
            >
              {submitting ? 'Rolling back...' : 'Confirm Rollback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PinModal({
  slug,
  versions,
  onClose,
  onSuccess,
}: {
  slug: string;
  versions: PackVersion[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [businessId, setBusinessId] = useState('');
  const [pinnedVersion, setPinnedVersion] = useState(versions[0]?.version || 1);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/admin/packs-console/${slug}/pins`, {
        businessId,
        pinnedVersion,
        reason,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to pin business');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      data-testid="pin-modal"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pin Business</h2>
          <button onClick={onClose} data-testid="modal-close-pin">
            <X size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Business ID
            </label>
            <input
              type="text"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              placeholder="Enter business ID"
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 rounded-xl p-3 text-sm"
              data-testid="pin-business-id"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Pin to Version
            </label>
            <select
              value={pinnedVersion}
              onChange={(e) => setPinnedVersion(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 rounded-xl p-3 text-sm"
              data-testid="pin-version-select"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} ({stageLabel(v.rolloutStage)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this business pinned?"
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 rounded-xl p-3 text-sm resize-none h-20"
              data-testid="pin-reason"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !businessId.trim() || !reason.trim()}
              className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              data-testid="confirm-pin"
            >
              {submitting ? 'Pinning...' : 'Pin Business'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
