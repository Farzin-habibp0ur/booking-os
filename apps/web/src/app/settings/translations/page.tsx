'use client';

import { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { useI18n, SUPPORTED_LOCALES } from '@/lib/i18n';
import { useToast } from '@/lib/toast';
import { Search, RotateCcw, Check, ChevronLeft, Filter } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRouter } from 'next/navigation';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

const LOCALE_FILES: Record<string, Record<string, any>> = { en, es };

// Flatten nested JSON into dot-notation keys
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

export default function TranslationsPage() {
  const { t, locale: currentLocale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedLocale, setSelectedLocale] = useState(() => {
    // Default to the non-English locale if currently viewing English
    return currentLocale === 'en' && SUPPORTED_LOCALES.length > 1
      ? SUPPORTED_LOCALES.find((l) => l.code !== 'en')?.code || 'en'
      : currentLocale;
  });

  const [overrides, setOverrides] = useState<Record<string, { id: string; value: string; updatedAt: string }>>({});
  const [search, setSearch] = useState('');
  const [showOverridesOnly, setShowOverridesOnly] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Get all flattened keys from the English file (source of truth)
  const allKeys = useMemo(() => flattenObject(en), []);
  const localeDefaults = useMemo(() => flattenObject(LOCALE_FILES[selectedLocale] || {}), [selectedLocale]);

  // Load overrides from API
  const loadOverrides = () => {
    api.get<any[]>(`/translations/keys?locale=${selectedLocale}`)
      .then((items) => {
        const map: Record<string, { id: string; value: string; updatedAt: string }> = {};
        for (const item of items) {
          map[item.key] = { id: item.id, value: item.value, updatedAt: item.updatedAt };
        }
        setOverrides(map);
      })
      .catch(() => setOverrides({}));
  };

  useEffect(() => {
    loadOverrides();
  }, [selectedLocale]);

  // Filter keys based on search and overrides-only mode
  const filteredKeys = useMemo(() => {
    let keys = Object.keys(allKeys);

    if (showOverridesOnly) {
      keys = keys.filter((k) => overrides[k]);
    }

    if (search) {
      const q = search.toLowerCase();
      keys = keys.filter((k) =>
        k.toLowerCase().includes(q)
        || allKeys[k].toLowerCase().includes(q)
        || (localeDefaults[k] || '').toLowerCase().includes(q)
        || (overrides[k]?.value || '').toLowerCase().includes(q)
      );
    }

    return keys;
  }, [allKeys, localeDefaults, overrides, search, showOverridesOnly]);

  const overrideCount = Object.keys(overrides).length;

  const startEditing = (key: string) => {
    setEditingKey(key);
    setEditValue(overrides[key]?.value || localeDefaults[key] || allKeys[key]);
  };

  const saveOverride = async (key: string) => {
    setSaving(true);
    try {
      await api.post('/translations', { locale: selectedLocale, key, value: editValue });
      toast(t('translations.save_success'));
      setEditingKey(null);
      loadOverrides();
    } catch {
      toast('Failed to save');
    }
    setSaving(false);
  };

  const resetOverride = async (key: string) => {
    if (!confirm(t('translations.reset_confirm'))) return;
    try {
      await api.del(`/translations/${selectedLocale}/${encodeURIComponent(key)}`);
      toast(t('translations.reset_success'));
      loadOverrides();
    } catch {
      toast('Failed to reset');
    }
  };

  // Group keys by top-level section
  const groupedKeys = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const key of filteredKeys) {
      const section = key.split('.')[0];
      if (!groups[section]) groups[section] = [];
      groups[section].push(key);
    }
    return groups;
  }, [filteredKeys]);

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => router.push('/settings')} className="p-1 hover:bg-gray-100 rounded">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">{t('translations.title')}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6 ml-9">{t('translations.description')}</p>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        {/* Locale selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">{t('translations.locale_label')}:</label>
          <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
            {SUPPORTED_LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => setSelectedLocale(l.code)}
                className={cn(
                  'px-3 py-1.5 rounded text-sm transition-colors',
                  selectedLocale === l.code ? 'bg-white shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('translations.search_placeholder')}
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowOverridesOnly(!showOverridesOnly)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors',
            showOverridesOnly ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-gray-50',
          )}
        >
          <Filter size={14} />
          {showOverridesOnly ? t('translations.show_all') : t('translations.show_overrides')}
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
        <span>{filteredKeys.length} keys</span>
        {overrideCount > 0 && (
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs">
            {t('translations.overrides_count', { count: overrideCount })}
          </span>
        )}
      </div>

      {/* Translation table grouped by section */}
      <div className="space-y-6">
        {Object.entries(groupedKeys).map(([section, keys]) => (
          <div key={section} className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{section}</h3>
            </div>
            <div className="divide-y">
              {keys.map((key) => {
                const hasOverride = !!overrides[key];
                const isEditing = editingKey === key;
                const defaultValue = localeDefaults[key] || allKeys[key];
                const displayValue = overrides[key]?.value || defaultValue;

                return (
                  <div key={key} className={cn('px-4 py-3', hasOverride && 'bg-blue-50/30')}>
                    <div className="flex items-start gap-4">
                      {/* Key */}
                      <div className="w-48 flex-shrink-0">
                        <code className="text-xs text-gray-500 break-all">{key}</code>
                      </div>

                      {/* English default */}
                      <div className="w-48 flex-shrink-0">
                        <p className="text-xs text-gray-400 mb-0.5">{selectedLocale === 'en' ? 'Default' : 'English'}</p>
                        <p className="text-sm text-gray-600">{allKeys[key]}</p>
                      </div>

                      {/* Current value / edit */}
                      <div className="flex-1">
                        <p className="text-xs text-gray-400 mb-0.5">
                          {hasOverride ? t('translations.override_column') : t('translations.default_column')}
                        </p>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveOverride(key);
                                if (e.key === 'Escape') setEditingKey(null);
                              }}
                            />
                            <button
                              onClick={() => saveOverride(key)}
                              disabled={saving}
                              className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingKey(null)}
                              className="p-1.5 border rounded hover:bg-gray-50 text-sm"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <p
                              onClick={() => startEditing(key)}
                              className={cn(
                                'text-sm cursor-pointer hover:bg-gray-100 rounded px-1 -mx-1 py-0.5',
                                hasOverride ? 'text-blue-700 font-medium' : 'text-gray-700',
                              )}
                            >
                              {displayValue}
                            </p>
                            {hasOverride && (
                              <button
                                onClick={() => resetOverride(key)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-opacity"
                                title="Reset to default"
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredKeys.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>{t('translations.no_results')}</p>
        </div>
      )}
    </div>
  );
}
