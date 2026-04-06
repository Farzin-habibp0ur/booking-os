'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';
import { Plus, Trash2, Save, FolderOpen, Users } from 'lucide-react';

// P-16: Available filter fields and their compatible operators
const FILTER_FIELDS = [
  { key: 'tags', labelKey: 'campaigns.filter_builder.tags', type: 'text' },
  { key: 'lastVisitDaysAgo', labelKey: 'campaigns.filter_builder.last_visit', type: 'number' },
  {
    key: 'bookingCountGte',
    labelKey: 'campaigns.filter_builder.booking_count_min',
    type: 'number',
  },
  {
    key: 'bookingCountLte',
    labelKey: 'campaigns.filter_builder.booking_count_max',
    type: 'number',
  },
  { key: 'createdAfter', labelKey: 'campaigns.filter_builder.created_after', type: 'date' },
  { key: 'createdBefore', labelKey: 'campaigns.filter_builder.created_before', type: 'date' },
  { key: 'spentMoreThan', labelKey: 'campaigns.filter_builder.spent_more', type: 'number' },
  { key: 'spentLessThan', labelKey: 'campaigns.filter_builder.spent_less', type: 'number' },
  {
    key: 'noUpcomingBooking',
    labelKey: 'campaigns.filter_builder.no_upcoming_booking',
    type: 'boolean',
  },
  { key: 'excludeDoNotMessage', labelKey: 'campaigns.filter_builder.exclude_dnd', type: 'boolean' },
] as const;

export interface FilterRule {
  id: string;
  field: string;
  value: string;
}

interface SavedSegment {
  id: string;
  name: string;
  filters: Record<string, unknown>;
}

interface CampaignFilterBuilderProps {
  filters: Record<string, any>;
  onChange: (filters: Record<string, any>) => void;
}

export default function CampaignFilterBuilder({ filters, onChange }: CampaignFilterBuilderProps) {
  const { t } = useI18n();
  const [rules, setRules] = useState<FilterRule[]>(() => filtersToRules(filters));
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [segments, setSegments] = useState<SavedSegment[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [showLoadDropdown, setShowLoadDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved segments on mount
  useEffect(() => {
    api
      .get<SavedSegment[]>('/campaigns/segments')
      .then((data) => setSegments(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Convert filters object to rule rows
  function filtersToRules(f: Record<string, any>): FilterRule[] {
    const result: FilterRule[] = [];
    for (const [key, value] of Object.entries(f)) {
      if (key === 'tags' && Array.isArray(value) && value.length > 0) {
        result.push({ id: genId(), field: 'tags', value: value.join(', ') });
      } else if (typeof value === 'boolean' && value) {
        result.push({ id: genId(), field: key, value: 'true' });
      } else if (value != null && value !== '' && value !== false) {
        result.push({ id: genId(), field: key, value: String(value) });
      }
    }
    return result;
  }

  // Convert rule rows back to filters object
  function rulesToFilters(r: FilterRule[]): Record<string, any> {
    const f: Record<string, any> = {};
    for (const rule of r) {
      if (!rule.field || rule.value === '') continue;
      const fieldDef = FILTER_FIELDS.find((fd) => fd.key === rule.field);
      if (!fieldDef) continue;

      if (rule.field === 'tags') {
        f.tags = rule.value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (fieldDef.type === 'boolean') {
        f[rule.field] = rule.value === 'true';
      } else if (fieldDef.type === 'number') {
        f[rule.field] = Number(rule.value);
      } else {
        f[rule.field] = rule.value;
      }
    }
    return f;
  }

  // Debounced preview fetch
  const fetchPreview = useCallback((currentFilters: Record<string, any>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await api.post<{ count: number }>('/campaigns/audience-preview', {
          filters: currentFilters,
        });
        setPreviewCount(res.count);
      } catch {
        setPreviewCount(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);
  }, []);

  // Sync rules -> filters -> preview
  useEffect(() => {
    const newFilters = rulesToFilters(rules);
    onChange(newFilters);
    fetchPreview(newFilters);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rules]);

  function genId() {
    return Math.random().toString(36).slice(2, 9);
  }

  function addRule() {
    setRules([...rules, { id: genId(), field: '', value: '' }]);
  }

  function removeRule(id: string) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function updateRule(id: string, field: string, value: string) {
    setRules(rules.map((r) => (r.id === id ? { ...r, field, value } : r)));
  }

  async function saveSegment() {
    if (!segmentName.trim()) return;
    try {
      const newSeg = await api.post<SavedSegment>('/campaigns/segments', {
        name: segmentName.trim(),
        filters: rulesToFilters(rules),
      });
      setSegments([newSeg, ...segments]);
      setShowSaveModal(false);
      setSegmentName('');
    } catch {
      // ignore
    }
  }

  function loadSegment(seg: SavedSegment) {
    const f = (seg.filters || {}) as Record<string, any>;
    setRules(filtersToRules(f));
    setShowLoadDropdown(false);
  }

  function getFieldType(fieldKey: string) {
    return FILTER_FIELDS.find((f) => f.key === fieldKey)?.type || 'text';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {t('campaigns.filter_builder.audience_filters')}
        </h3>
        <div className="flex items-center gap-2">
          {/* Live preview badge */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
              previewLoading ? 'bg-slate-100 text-slate-400' : 'bg-sage-50 text-sage-700',
            )}
            data-testid="preview-badge"
          >
            <Users size={12} />
            {previewLoading ? '...' : previewCount != null ? previewCount : '—'}
          </div>
        </div>
      </div>

      {/* Filter rules */}
      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center gap-2" data-testid="filter-rule">
            <select
              value={rule.field}
              onChange={(e) => updateRule(rule.id, e.target.value, rule.value)}
              className="flex-1 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
              aria-label="Filter field"
            >
              <option value="">{t('campaigns.filter_builder.select_field')}</option>
              {FILTER_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {t(f.labelKey)}
                </option>
              ))}
            </select>

            {getFieldType(rule.field) === 'boolean' ? (
              <select
                value={rule.value}
                onChange={(e) => updateRule(rule.id, rule.field, e.target.value)}
                className="flex-1 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
                aria-label="Filter value"
              >
                <option value="true">{t('common.yes')}</option>
                <option value="false">{t('common.no')}</option>
              </select>
            ) : (
              <input
                type={
                  getFieldType(rule.field) === 'number'
                    ? 'number'
                    : getFieldType(rule.field) === 'date'
                      ? 'date'
                      : 'text'
                }
                value={rule.value}
                onChange={(e) => updateRule(rule.id, rule.field, e.target.value)}
                placeholder={
                  rule.field === 'tags'
                    ? 'vip, returning'
                    : getFieldType(rule.field) === 'number'
                      ? '0'
                      : ''
                }
                className="flex-1 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
                aria-label="Filter value"
              />
            )}

            <button
              onClick={() => removeRule(rule.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
              aria-label="Remove filter"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={addRule}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-sage-700 bg-sage-50 rounded-xl hover:bg-sage-100 transition-colors"
          data-testid="add-rule-btn"
        >
          <Plus size={12} />
          {t('campaigns.filter_builder.add_filter')}
        </button>

        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          data-testid="save-segment-btn"
        >
          <Save size={12} />
          {t('campaigns.filter_builder.save_as_segment')}
        </button>

        <div className="relative">
          <button
            onClick={() => setShowLoadDropdown(!showLoadDropdown)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            data-testid="load-segment-btn"
          >
            <FolderOpen size={12} />
            {t('campaigns.filter_builder.load_segment')}
          </button>

          {showLoadDropdown && (
            <div
              className="absolute z-10 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1"
              data-testid="segment-dropdown"
            >
              {segments.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">
                  {t('campaigns.filter_builder.no_saved_segments')}
                </p>
              ) : (
                segments.map((seg) => (
                  <button
                    key={seg.id}
                    onClick={() => loadSegment(seg)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {seg.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save segment modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          data-testid="save-segment-modal"
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              {t('campaigns.filter_builder.save_as_segment')}
            </h3>
            <input
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              placeholder={t('campaigns.filter_builder.segment_name')}
              className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500 mb-4"
              data-testid="segment-name-input"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={saveSegment}
                disabled={!segmentName.trim()}
                className={cn(
                  'px-4 py-2 text-sm rounded-xl transition-colors',
                  segmentName.trim()
                    ? 'bg-sage-600 text-white hover:bg-sage-700'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed',
                )}
                data-testid="confirm-save-segment"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
