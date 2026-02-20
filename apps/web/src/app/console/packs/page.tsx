'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Package, Layers, ArrowRight, ToggleLeft, Users } from 'lucide-react';

interface PackRegistryItem {
  slug: string;
  name: string;
  description: string | null;
  latestVersion: number;
  rolloutStage: string;
  rolloutPercent: number;
  isPublished: boolean;
  businessCount: number;
  totalBusinesses: number;
  adoptionPercent: number;
  skillCount: number;
  versionCount: number;
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

export default function ConsolePacksPage() {
  const [packs, setPacks] = useState<PackRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'registry' | 'skills'>('registry');

  const fetchRegistry = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.get<PackRegistryItem[]>('/admin/packs-console/registry');
      setPacks(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load pack registry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistry();
  }, [fetchRegistry]);

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl" data-testid="packs-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-40" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-6xl">
        <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
          Packs & Skills
        </h1>
        <div
          className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 text-red-700 dark:text-red-400"
          data-testid="packs-error"
        >
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <h1 className="text-2xl font-serif font-bold text-slate-900 dark:text-white mb-6">
        Packs & Skills
      </h1>

      {/* Sub-navigation tabs */}
      <div
        className="flex gap-1 mb-6 border-b border-slate-100 dark:border-slate-800"
        data-testid="packs-tabs"
      >
        <button
          onClick={() => setTab('registry')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'registry'
              ? 'border-sage-600 text-sage-700 dark:text-sage-400'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          data-testid="tab-registry"
        >
          Pack Registry
        </button>
        <Link
          href="/console/packs/skills"
          className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 -mb-px"
          data-testid="tab-skills"
        >
          Skills Catalog
        </Link>
      </div>

      {packs.length === 0 ? (
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-8 text-center"
          data-testid="packs-empty"
        >
          <Package size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No packs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="pack-grid">
          {packs.map((pack) => (
            <Link
              key={pack.slug}
              href={`/console/packs/${pack.slug}`}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 hover:shadow-md transition-shadow group"
              data-testid={`pack-card-${pack.slug}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-lavender-50 dark:bg-lavender-900/20 rounded-xl">
                    <Package size={18} className="text-lavender-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {pack.name}
                    </h3>
                    <span className="text-xs text-slate-400">v{pack.latestVersion}</span>
                  </div>
                </div>
                <ArrowRight
                  size={14}
                  className="text-slate-400 group-hover:text-slate-600 transition-colors"
                />
              </div>

              {pack.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{pack.description}</p>
              )}

              {/* Rollout status */}
              <div className="mb-3">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${stageColors[pack.rolloutStage] || stageColors.draft}`}
                  data-testid={`rollout-badge-${pack.slug}`}
                >
                  {stageLabel(pack.rolloutStage)}
                  {pack.rolloutStage === 'rolling_out' && ` ${pack.rolloutPercent}%`}
                </span>
              </div>

              {/* Adoption bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">Adoption</span>
                  <span
                    className="text-slate-600 dark:text-slate-300 font-medium"
                    data-testid={`adoption-${pack.slug}`}
                  >
                    {pack.adoptionPercent}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-sage-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pack.adoptionPercent}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <Users size={12} />
                  <span data-testid={`business-count-${pack.slug}`}>
                    {pack.businessCount} business{pack.businessCount !== 1 ? 'es' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Layers size={12} />
                  <span>{pack.skillCount} skills</span>
                </div>
                <div className="flex items-center gap-1">
                  <ToggleLeft size={12} />
                  <span>{pack.versionCount} ver.</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
