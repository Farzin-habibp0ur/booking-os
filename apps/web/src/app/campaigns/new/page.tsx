'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ArrowLeft, ArrowRight, Users, MessageSquare, Clock, CheckCircle } from 'lucide-react';

const STEPS = ['Audience', 'Message', 'Schedule', 'Review'];
const stepIcons = [Users, MessageSquare, Clock, CheckCircle];

export default function NewCampaignPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [filters, setFilters] = useState<any>({
    tags: [],
    noUpcomingBooking: false,
    excludeDoNotMessage: true,
  });
  const [templateId, setTemplateId] = useState('');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [throttle, setThrottle] = useState(10);
  const [preview, setPreview] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    api
      .get<any>('/templates')
      .then((t) => setTemplates(Array.isArray(t) ? t : t.data || []))
      .catch(() => {});
  }, []);

  const loadPreview = () => {
    api
      .post<any>('/campaigns/0/preview', { filters })
      .then(setPreview)
      .catch(() => {});
  };

  useEffect(() => {
    if (step === 0) loadPreview();
  }, [step, filters]);

  const addTag = () => {
    if (tagInput.trim() && !filters.tags.includes(tagInput.trim())) {
      setFilters({ ...filters, tags: [...filters.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFilters({ ...filters, tags: filters.tags.filter((t: string) => t !== tag) });
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const campaign = await api.post<any>('/campaigns', {
        name,
        templateId: templateId || undefined,
        filters,
        scheduledAt: scheduleType === 'later' ? scheduledAt : undefined,
        throttlePerMinute: throttle,
      });
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return preview?.count > 0;
    if (step === 1) return !!templateId;
    if (step === 2) return scheduleType === 'now' || !!scheduledAt;
    if (step === 3) return !!name;
    return true;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.push('/campaigns')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ArrowLeft size={16} /> Back to Campaigns
      </button>

      <h1 className="text-2xl font-serif font-semibold text-slate-900 mb-6">New Campaign</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = stepIcons[i];
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div className={cn('w-8 h-px', i <= step ? 'bg-sage-400' : 'bg-slate-200')} />
              )}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                  i === step
                    ? 'bg-sage-100 text-sage-700'
                    : i < step
                      ? 'bg-sage-50 text-sage-600'
                      : 'bg-slate-100 text-slate-400',
                )}
              >
                <Icon size={14} />
                {s}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 0: Audience */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Audience Filters</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Customer tags</label>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="e.g. vip, returning"
                    className="flex-1 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
                  />
                  <button
                    onClick={addTag}
                    className="px-3 py-2 text-sm bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {filters.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {filters.tags.map((t: string) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-sage-50 text-sage-700 text-xs rounded-full"
                      >
                        {t}
                        <button
                          onClick={() => removeTag(t)}
                          className="text-sage-400 hover:text-sage-600"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.noUpcomingBooking}
                  onChange={(e) => setFilters({ ...filters, noUpcomingBooking: e.target.checked })}
                  className="rounded text-sage-600"
                />
                No upcoming bookings
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.excludeDoNotMessage}
                  onChange={(e) =>
                    setFilters({ ...filters, excludeDoNotMessage: e.target.checked })
                  }
                  className="rounded text-sage-600"
                />
                Exclude "do-not-message" tagged customers
              </label>
            </div>
          </div>

          {preview && (
            <div className="bg-white rounded-2xl shadow-soft p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Audience Preview</h2>
              <p className="text-2xl font-serif font-bold text-sage-700">{preview.count}</p>
              <p className="text-xs text-slate-500 mb-3">matching customers</p>
              {preview.samples?.length > 0 && (
                <div className="space-y-1">
                  {preview.samples.map((s: any) => (
                    <p key={s.id} className="text-sm text-slate-600">
                      {s.name} · {s.phone}
                    </p>
                  ))}
                  {preview.count > 5 && (
                    <p className="text-xs text-slate-400">and {preview.count - 5} more...</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Message */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-soft p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Select Template</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-slate-400">
              No templates found. Create one in Settings → Templates first.
            </p>
          ) : (
            <div className="space-y-2">
              {templates.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors',
                    templateId === t.id
                      ? 'border-sage-400 bg-sage-50 text-sage-900'
                      : 'border-slate-100 hover:bg-slate-50',
                  )}
                >
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {t.body?.substring(0, 80)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Schedule */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-soft p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">When to send</h2>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="schedule"
                checked={scheduleType === 'now'}
                onChange={() => setScheduleType('now')}
                className="text-sage-600"
              />
              Send immediately after creation
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="schedule"
                checked={scheduleType === 'later'}
                onChange={() => setScheduleType('later')}
                className="text-sage-600"
              />
              Schedule for later
            </label>
          </div>

          {scheduleType === 'later' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
            />
          )}

          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              Throttle (messages per minute)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={throttle}
              onChange={(e) => setThrottle(Number(e.target.value))}
              className="w-24 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
            />
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Campaign Name</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. February Re-engagement"
              className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
            />
          </div>

          <div className="bg-white rounded-2xl shadow-soft p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Audience</dt>
                <dd className="font-medium">{preview?.count || 0} customers</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Template</dt>
                <dd className="font-medium">
                  {templates.find((t: any) => t.id === templateId)?.name || '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Schedule</dt>
                <dd className="font-medium">
                  {scheduleType === 'now' ? 'Immediately' : new Date(scheduledAt).toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Throttle</dt>
                <dd className="font-medium">{throttle} msg/min</dd>
              </div>
            </dl>
          </div>

          {preview?.count > 100 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
              This campaign will reach {preview.count} customers. Make sure your template is ready.
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : router.push('/campaigns'))}
          className="flex items-center gap-1 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} />
          {step > 0 ? 'Back' : 'Cancel'}
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className={cn(
              'flex items-center gap-1 px-4 py-2 text-sm rounded-xl transition-colors',
              canProceed()
                ? 'bg-sage-600 text-white hover:bg-sage-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            Next
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={!canProceed() || saving}
            className={cn(
              'flex items-center gap-1 px-4 py-2 text-sm rounded-xl transition-colors',
              canProceed() && !saving
                ? 'bg-sage-600 text-white hover:bg-sage-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            {saving ? 'Creating...' : 'Create Campaign'}
          </button>
        )}
      </div>
    </div>
  );
}
