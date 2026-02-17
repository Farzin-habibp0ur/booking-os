'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  ArrowLeft,
  GripVertical,
  Trash2,
  Eye,
  Save,
  Upload,
  ChevronDown,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { EmptyState, CardSkeleton } from '@/components/skeleton';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PackField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface PackConfig {
  labels: { customer: string; booking: string; service: string };
  intakeFields: PackField[];
  defaultServices: any[];
  defaultTemplates: any[];
  defaultAutomations: any[];
  kanbanEnabled: boolean;
  kanbanStatuses: string[];
}

interface Pack {
  id: string;
  slug: string;
  version: number;
  name: string;
  description: string | null;
  config: PackConfig;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

type EditorTab = 'labels' | 'fields';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
];

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function PackBuilderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPack, setEditingPack] = useState<Pack | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Guard: only SUPER_ADMIN
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  const loadPacks = useCallback(async () => {
    try {
      const data = await api.get<Pack[]>('/admin/packs');
      setPacks(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPacks().finally(() => setLoading(false));
  }, [loadPacks]);

  const handleEdit = async (slug: string) => {
    try {
      const pack = await api.get<Pack>(`/admin/packs/${slug}`);
      setEditingPack(pack);
    } catch {
      // ignore
    }
  };

  const handleBack = () => {
    setEditingPack(null);
    loadPacks();
  };

  if (user?.role !== 'SUPER_ADMIN') return null;

  if (editingPack) {
    return <PackEditor pack={editingPack} onBack={handleBack} />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-slate-900">Pack Builder</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage vertical packs for different industries
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
        >
          <Plus size={16} />
          New Pack
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : packs.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No packs yet"
          description="Create your first vertical pack to customize the platform for a specific industry."
          action={{ label: 'Create Pack', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} onEdit={() => handleEdit(pack.slug)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePackModal
          onClose={() => setShowCreate(false)}
          onCreated={(pack) => {
            setShowCreate(false);
            setEditingPack(pack);
          }}
        />
      )}
    </div>
  );
}

// ─── Pack Card ──────────────────────────────────────────────────────────────

function PackCard({ pack, onEdit }: { pack: Pack; onEdit: () => void }) {
  const config = pack.config as PackConfig;
  const fieldCount = config?.intakeFields?.length || 0;

  return (
    <button
      onClick={onEdit}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 text-left hover:shadow-md transition-shadow w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-lavender-50 rounded-lg flex items-center justify-center">
            <Package size={18} className="text-lavender-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {pack.name}
            </h3>
            <p className="text-[10px] text-slate-400">{pack.slug}</p>
          </div>
        </div>
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium',
            pack.isPublished ? 'bg-sage-50 text-sage-700' : 'bg-amber-50 text-amber-700',
          )}
        >
          {pack.isPublished ? 'Published' : 'Draft'}
        </span>
      </div>
      {pack.description && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{pack.description}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>v{pack.version}</span>
        <span>{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
        {config?.kanbanEnabled && <span>Kanban</span>}
      </div>
    </button>
  );
}

// ─── Create Pack Modal ──────────────────────────────────────────────────────

function CreatePackModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (pack: Pack) => void;
}) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const pack = await api.post<Pack>('/admin/packs', {
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name,
        description: description || undefined,
      });
      onCreated(pack);
    } catch (err: any) {
      setError(err.message || 'Failed to create pack');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6 w-full max-w-md">
        <h2 className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Create New Pack
        </h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
              }}
              placeholder="e.g. Dealership"
              required
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              placeholder="e.g. dealership"
              required
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
            <p className="text-[10px] text-slate-400 mt-1">Lowercase, no spaces. Used as unique identifier.</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pack Editor ────────────────────────────────────────────────────────────

function PackEditor({ pack, onBack }: { pack: Pack; onBack: () => void }) {
  const [tab, setTab] = useState<EditorTab>('labels');
  const [config, setConfig] = useState<PackConfig>(
    (pack.config as PackConfig) || {
      labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
      intakeFields: [],
      defaultServices: [],
      defaultTemplates: [],
      defaultAutomations: [],
      kanbanEnabled: false,
      kanbanStatuses: [],
    },
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [packState, setPackState] = useState(pack);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = async () => {
    if (packState.isPublished) return;
    setSaving(true);
    try {
      const updated = await api.patch<Pack>(`/admin/packs/${packState.id}`, { config });
      setPackState(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('Publish this pack version? It will become immutable.')) return;
    setPublishing(true);
    try {
      const published = await api.post<Pack>(`/admin/packs/${packState.id}/publish`);
      setPackState(published);
    } catch {
      // ignore
    } finally {
      setPublishing(false);
    }
  };

  const handleNewVersion = async () => {
    try {
      const newDraft = await api.post<Pack>(`/admin/packs/${packState.slug}/new-version`);
      setPackState(newDraft);
      setConfig(newDraft.config as PackConfig);
    } catch {
      // ignore
    }
  };

  const tabs: { key: EditorTab; label: string }[] = [
    { key: 'labels', label: 'Labels' },
    { key: 'fields', label: 'Intake Fields' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            aria-label="Back to packs"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
              {packState.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">{packState.slug}</span>
              <span className="text-xs text-slate-300">|</span>
              <span className="text-xs text-slate-400">v{packState.version}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                  packState.isPublished
                    ? 'bg-sage-50 text-sage-700'
                    : 'bg-amber-50 text-amber-700',
                )}
              >
                {packState.isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Eye size={16} />
            Preview
          </button>
          {!packState.isPublished && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <Upload size={16} />
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </>
          )}
          {packState.isPublished && (
            <button
              onClick={handleNewVersion}
              className="flex items-center gap-1.5 px-3 py-2 bg-sage-600 text-white rounded-xl text-sm hover:bg-sage-700 transition-colors"
            >
              <Copy size={16} />
              New Version
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-1.5 text-sm rounded-lg transition-colors',
              tab === t.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-medium'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Main Editor */}
        <div className="flex-1 min-w-0">
          {tab === 'labels' && (
            <LabelsEditor
              labels={config.labels}
              kanbanEnabled={config.kanbanEnabled}
              kanbanStatuses={config.kanbanStatuses}
              disabled={packState.isPublished}
              onChange={(labels) => setConfig({ ...config, labels })}
              onKanbanChange={(enabled, statuses) =>
                setConfig({ ...config, kanbanEnabled: enabled, kanbanStatuses: statuses })
              }
            />
          )}
          {tab === 'fields' && (
            <FieldsEditor
              fields={config.intakeFields}
              disabled={packState.isPublished}
              onChange={(fields) => setConfig({ ...config, intakeFields: fields })}
            />
          )}
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="w-80 shrink-0">
            <PreviewPanel config={config} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Labels Editor ──────────────────────────────────────────────────────────

function LabelsEditor({
  labels,
  kanbanEnabled,
  kanbanStatuses,
  disabled,
  onChange,
  onKanbanChange,
}: {
  labels: PackConfig['labels'];
  kanbanEnabled: boolean;
  kanbanStatuses: string[];
  disabled: boolean;
  onChange: (labels: PackConfig['labels']) => void;
  onKanbanChange: (enabled: boolean, statuses: string[]) => void;
}) {
  const labelEntries: { key: keyof PackConfig['labels']; label: string; hint: string }[] = [
    { key: 'customer', label: 'Customer', hint: 'What you call your customers (e.g. Client, Patient, Guest)' },
    { key: 'booking', label: 'Booking', hint: 'What you call bookings (e.g. Appointment, Visit, Session)' },
    { key: 'service', label: 'Service', hint: 'What you call services (e.g. Treatment, Class, Appointment)' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Entity Labels
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Customize the terminology used throughout the platform for this vertical.
        </p>
        <div className="space-y-4">
          {labelEntries.map(({ key, label, hint }) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                value={labels[key]}
                onChange={(e) => onChange({ ...labels, [key]: e.target.value })}
                disabled={disabled}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 disabled:opacity-50"
              />
              <p className="text-[10px] text-slate-400 mt-1">{hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Kanban Board
        </h2>
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={kanbanEnabled}
            onChange={(e) => onKanbanChange(e.target.checked, kanbanStatuses)}
            disabled={disabled}
            className="rounded text-sage-600 focus:ring-sage-500"
          />
          <span className="text-sm">Enable service kanban board</span>
        </label>
        {kanbanEnabled && (
          <div>
            <label className="block text-sm font-medium mb-1">Kanban Statuses</label>
            <p className="text-[10px] text-slate-400 mb-2">
              Comma-separated status names for kanban columns
            </p>
            <input
              value={kanbanStatuses.join(', ')}
              onChange={(e) =>
                onKanbanChange(
                  kanbanEnabled,
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              disabled={disabled}
              placeholder="CHECKED_IN, DIAGNOSING, IN_PROGRESS, READY"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 disabled:opacity-50"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Fields Editor ──────────────────────────────────────────────────────────

function FieldsEditor({
  fields,
  disabled,
  onChange,
}: {
  fields: PackField[];
  disabled: boolean;
  onChange: (fields: PackField[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const addField = () => {
    const key = `field_${Date.now()}`;
    onChange([...fields, { key, label: '', type: 'text' }]);
  };

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<PackField>) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, ...updates } : f));
    onChange(updated);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...fields];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    onChange(updated);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Intake Fields
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define the custom fields collected during intake. Drag to reorder.
          </p>
        </div>
        {!disabled && (
          <button
            onClick={addField}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-600 text-white rounded-xl text-xs hover:bg-sage-700 transition-colors"
          >
            <Plus size={14} />
            Add Field
          </button>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">No intake fields defined yet.</p>
          {!disabled && (
            <button
              onClick={addField}
              className="mt-2 text-sage-600 text-sm hover:underline"
            >
              Add your first field
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.key}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                'border rounded-xl p-3 transition-colors',
                dragOverIndex === index
                  ? 'border-sage-400 bg-sage-50/50'
                  : 'border-slate-200 dark:border-slate-700',
                dragIndex === index && 'opacity-50',
              )}
            >
              <div className="flex items-start gap-2">
                {!disabled && (
                  <div className="pt-2 cursor-grab text-slate-400 hover:text-slate-600" aria-label="Drag to reorder">
                    <GripVertical size={16} />
                  </div>
                )}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <input
                      value={field.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                        updateField(index, { label, key: key || field.key });
                      }}
                      placeholder="Label"
                      disabled={disabled}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <input
                      value={field.key}
                      onChange={(e) => updateField(index, { key: e.target.value })}
                      placeholder="key"
                      disabled={disabled}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 disabled:opacity-50 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(index, { type: e.target.value })}
                      disabled={disabled}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-800 disabled:opacity-50"
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>
                          {ft.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required || false}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                        disabled={disabled}
                        className="rounded text-sage-600 focus:ring-sage-500"
                      />
                      Required
                    </label>
                    {!disabled && (
                      <button
                        onClick={() => removeField(index)}
                        className="ml-auto p-1 text-slate-400 hover:text-red-500 transition-colors"
                        aria-label="Remove field"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {field.type === 'dropdown' && (
                <div className="mt-2 ml-6">
                  <input
                    value={field.options?.join(', ') || ''}
                    onChange={(e) =>
                      updateField(index, {
                        options: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Comma-separated options (e.g. New, Used, Trade-in)"
                    disabled={disabled}
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preview Panel ──────────────────────────────────────────────────────────

function PreviewPanel({ config }: { config: PackConfig }) {
  const fields = config.intakeFields;
  const labels = config.labels;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 sticky top-6">
      <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
        <Eye size={14} />
        Intake Card Preview
      </h3>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase">
            {labels.customer} Intake
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
            0/{fields.length}
          </span>
        </div>

        {fields.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No fields defined</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-xs text-slate-500">
                    {field.label || 'Unnamed'}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </span>
                </div>
                <div className="text-right min-w-0 flex-1">
                  {field.type === 'boolean' ? (
                    <input type="checkbox" disabled className="h-3 w-3 rounded opacity-50" />
                  ) : field.type === 'dropdown' ? (
                    <select
                      disabled
                      className="text-xs bg-slate-50 dark:bg-slate-800 rounded px-1 py-0.5 opacity-50"
                    >
                      <option>--</option>
                      {field.options?.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-400 italic text-xs">Not set</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {config.kanbanEnabled && config.kanbanStatuses.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[10px] font-semibold text-slate-500 uppercase mb-2">
            Kanban Columns
          </h4>
          <div className="flex flex-wrap gap-1">
            {config.kanbanStatuses.map((status) => (
              <span
                key={status}
                className="text-[10px] px-2 py-0.5 bg-lavender-50 text-lavender-700 rounded-full"
              >
                {status}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
