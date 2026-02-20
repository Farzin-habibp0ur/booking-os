'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { ChevronRight, ChevronDown, ToggleLeft, ToggleRight, Users } from 'lucide-react';

interface SkillStat {
  agentType: string;
  name: string;
  description: string;
  category: 'proactive' | 'reactive' | 'maintenance';
  defaultEnabled: boolean;
  enabledCount: number;
  businessCount: number;
  adoptionPercent: number;
}

interface PackSkills {
  slug: string;
  skills: SkillStat[];
}

interface SkillAdoption {
  agentType: string;
  name: string;
  category: string;
  totalBusinesses: number;
  enabledCount: number;
  configs: {
    businessId: string;
    businessName: string;
    businessSlug: string;
    verticalPack: string;
    isEnabled: boolean;
    autonomyLevel: string;
    createdAt: string;
  }[];
}

const categoryColors: Record<string, string> = {
  proactive: 'bg-sage-50 text-sage-700 dark:bg-sage-900/20 dark:text-sage-400',
  reactive: 'bg-lavender-50 text-lavender-700 dark:bg-lavender-900/20 dark:text-lavender-400',
  maintenance: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
};

export default function SkillsCatalogPage() {
  const [catalog, setCatalog] = useState<PackSkills[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillAdoption, setSkillAdoption] = useState<SkillAdoption | null>(null);
  const [adoptionLoading, setAdoptionLoading] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState<{
    agentType: string;
    name: string;
    enabled: boolean;
  } | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.get<{ packs: PackSkills[] }>('/admin/skills/catalog');
      setCatalog(result.packs);
      setExpandedPacks(new Set(result.packs.map((p) => p.slug)));
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load skills catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const togglePack = (slug: string) => {
    setExpandedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleSkillDetail = async (compositeKey: string) => {
    if (expandedSkill === compositeKey) {
      setExpandedSkill(null);
      setSkillAdoption(null);
      return;
    }

    setExpandedSkill(compositeKey);
    setAdoptionLoading(true);
    const agentType = compositeKey.split('-').slice(1).join('-');
    try {
      const result = await api.get<SkillAdoption>(`/admin/skills/${agentType}/adoption`);
      setSkillAdoption(result);
    } catch {
      setSkillAdoption(null);
    } finally {
      setAdoptionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl" data-testid="skills-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-40" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-6xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
          Skills Catalog
        </h1>
        <div
          className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 text-red-700 dark:text-red-400"
          data-testid="skills-error"
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-1 text-sm text-slate-500 mb-4"
        data-testid="skills-breadcrumb"
      >
        <Link href="/console/packs" className="hover:text-slate-700">
          Packs & Skills
        </Link>
        <ChevronRight size={14} />
        <span className="text-slate-900 dark:text-white font-medium">Skills Catalog</span>
      </nav>

      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
        Skills Catalog
      </h1>

      {catalog.length === 0 ? (
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center"
          data-testid="skills-empty"
        >
          <ToggleLeft size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No skills configured</p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="skills-catalog">
          {catalog.map((pack) => (
            <div
              key={pack.slug}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft overflow-hidden"
              data-testid={`pack-section-${pack.slug}`}
            >
              {/* Pack header */}
              <button
                onClick={() => togglePack(pack.slug)}
                className="w-full px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800"
                data-testid={`toggle-pack-${pack.slug}`}
              >
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                  {pack.slug} Pack
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{pack.skills.length} skills</span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform ${expandedPacks.has(pack.slug) ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {/* Skills table */}
              {expandedPacks.has(pack.slug) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="px-5 py-3">Name</th>
                        <th className="px-5 py-3">Agent Type</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Default</th>
                        <th className="px-5 py-3">Adoption</th>
                        <th className="px-5 py-3">Enabled</th>
                        <th className="px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pack.skills.map((skill) => (
                        <React.Fragment key={`${pack.slug}-${skill.agentType}`}>
                          <tr
                            className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                            onClick={() => toggleSkillDetail(`${pack.slug}-${skill.agentType}`)}
                            data-testid={`skill-row-${skill.agentType}`}
                          >
                            <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">
                              {skill.name}
                            </td>
                            <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                              {skill.agentType}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`text-xs font-medium px-2 py-1 rounded-full ${categoryColors[skill.category]}`}
                                data-testid={`category-badge-${skill.agentType}`}
                              >
                                {skill.category}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              {skill.defaultEnabled ? (
                                <span className="text-sage-600 text-xs font-medium">Yes</span>
                              ) : (
                                <span className="text-slate-400 text-xs">No</span>
                              )}
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                  <div
                                    className="bg-sage-500 h-1.5 rounded-full"
                                    style={{ width: `${skill.adoptionPercent}%` }}
                                  />
                                </div>
                                <span
                                  className="text-xs text-slate-500"
                                  data-testid={`adoption-pct-${skill.agentType}`}
                                >
                                  {skill.adoptionPercent}%
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-slate-600 dark:text-slate-400 text-xs">
                              <span data-testid={`enabled-count-${skill.agentType}`}>
                                {skill.enabledCount} / {skill.businessCount}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() =>
                                    setShowOverrideModal({
                                      agentType: skill.agentType,
                                      name: skill.name,
                                      enabled: true,
                                    })
                                  }
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-sage-600 hover:text-sage-700 font-medium"
                                  data-testid={`enable-all-${skill.agentType}`}
                                >
                                  <ToggleRight size={12} />
                                  Enable All
                                </button>
                                <button
                                  onClick={() =>
                                    setShowOverrideModal({
                                      agentType: skill.agentType,
                                      name: skill.name,
                                      enabled: false,
                                    })
                                  }
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 font-medium"
                                  data-testid={`disable-all-${skill.agentType}`}
                                >
                                  <ToggleLeft size={12} />
                                  Disable All
                                </button>
                              </div>
                            </td>
                          </tr>
                          {/* Expanded detail row */}
                          {expandedSkill === `${pack.slug}-${skill.agentType}` && (
                            <tr data-testid={`skill-detail-${skill.agentType}`}>
                              <td
                                colSpan={7}
                                className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50"
                              >
                                {adoptionLoading ? (
                                  <p className="text-sm text-slate-400">Loading adoption data...</p>
                                ) : skillAdoption ? (
                                  <div>
                                    <p className="text-xs text-slate-500 mb-2">
                                      {skillAdoption.enabledCount} of{' '}
                                      {skillAdoption.totalBusinesses} businesses enabled
                                    </p>
                                    {skillAdoption.configs.length > 0 ? (
                                      <div className="space-y-1">
                                        {skillAdoption.configs.map((c) => (
                                          <div
                                            key={c.businessId}
                                            className="flex items-center justify-between text-xs py-1"
                                          >
                                            <span className="text-slate-700 dark:text-slate-300">
                                              {c.businessName}
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <span className="text-slate-400">
                                                {c.verticalPack}
                                              </span>
                                              <span
                                                className={`font-medium ${c.isEnabled ? 'text-sage-600' : 'text-red-500'}`}
                                              >
                                                {c.isEnabled ? 'Enabled' : 'Disabled'}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400">
                                        No configurations found
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-400">
                                    Failed to load adoption data
                                  </p>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <OverrideModal
          agentType={showOverrideModal.agentType}
          name={showOverrideModal.name}
          enabled={showOverrideModal.enabled}
          onClose={() => setShowOverrideModal(null)}
          onSuccess={() => {
            setShowOverrideModal(null);
            fetchCatalog();
          }}
        />
      )}
    </div>
  );
}

function OverrideModal({
  agentType,
  name,
  enabled,
  onClose,
  onSuccess,
}: {
  agentType: string;
  name: string;
  enabled: boolean;
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
      await api.post(`/admin/skills/${agentType}/platform-override`, {
        enabled,
        reason: reason || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to apply override');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      data-testid="override-modal"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {enabled ? 'Enable' : 'Disable'} All — {name}
          </h2>
          <button onClick={onClose} data-testid="override-modal-close">
            <Users size={18} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>
        <div
          className={`rounded-xl p-3 mb-4 text-sm ${enabled ? 'bg-sage-50 text-sage-700 dark:bg-sage-900/20 dark:text-sage-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}
        >
          This will {enabled ? 'enable' : 'disable'} <strong>{name}</strong> for all businesses
          platform-wide. This is a high-risk action.
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this override needed?"
              className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 rounded-xl p-3 text-sm resize-none h-20"
              data-testid="override-reason"
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
              disabled={submitting}
              className={`px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
                enabled ? 'bg-sage-600 hover:bg-sage-700' : 'bg-red-600 hover:bg-red-700'
              }`}
              data-testid="confirm-override"
            >
              {submitting ? 'Applying...' : `${enabled ? 'Enable' : 'Disable'} All`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
