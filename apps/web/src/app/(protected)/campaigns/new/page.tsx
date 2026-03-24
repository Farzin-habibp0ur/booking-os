'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import {
  ArrowLeft,
  ArrowRight,
  Users,
  MessageSquare,
  Clock,
  CheckCircle,
  FlaskConical,
  Plus,
  Trash2,
} from 'lucide-react';
import CampaignFilterBuilder from '@/components/campaign-filter-builder';

const STEPS = ['Audience', 'Message', 'Schedule', 'Review'];

const MERGE_VARIABLES = [
  { label: 'Customer Name', value: '{{name}}' },
  { label: 'Service Name', value: '{{service}}' },
  { label: 'Business Name', value: '{{business}}' },
  { label: 'Next Booking Date', value: '{{date}}' },
  { label: 'Staff Name', value: '{{staff}}' },
];
const stepIcons = [Users, MessageSquare, Clock, CheckCircle];

export default function NewCampaignPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [filters, setFilters] = useState<any>({
    excludeDoNotMessage: true,
  });
  const [templateId, setTemplateId] = useState('');
  const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [throttle, setThrottle] = useState(10);
  const [recurrenceRule, setRecurrenceRule] = useState('NONE');
  const [preview, setPreview] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [isABTest, setIsABTest] = useState(false);
  const [variants, setVariants] = useState<any[]>([
    { id: crypto.randomUUID(), name: 'Variant A', content: '', percentage: 50 },
    { id: crypto.randomUUID(), name: 'Variant B', content: '', percentage: 50 },
  ]);
  const [activeVariant, setActiveVariant] = useState(0);
  const [channel, setChannel] = useState('WHATSAPP');
  const router = useRouter();

  const variantPercentageSum = variants.reduce((s, v) => s + Number(v.percentage || 0), 0);

  const addVariant = () => {
    if (variants.length >= 3) return;
    const newPct = Math.floor(100 / (variants.length + 1));
    const updated = variants.map((v) => ({ ...v, percentage: newPct }));
    updated.push({
      id: crypto.randomUUID(),
      name: `Variant ${String.fromCharCode(65 + variants.length)}`,
      content: '',
      percentage: 100 - newPct * variants.length,
    });
    setVariants(updated);
    setActiveVariant(updated.length - 1);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return;
    const updated = variants.filter((_, i) => i !== index);
    const newPct = Math.floor(100 / updated.length);
    const rebalanced = updated.map((v, i) => ({
      ...v,
      percentage: i === updated.length - 1 ? 100 - newPct * (updated.length - 1) : newPct,
    }));
    setVariants(rebalanced);
    setActiveVariant(Math.min(activeVariant, rebalanced.length - 1));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  useEffect(() => {
    api
      .get<any>('/templates')
      .then((t) => setTemplates(Array.isArray(t) ? t : t.data || []))
      .catch(() => {});
  }, []);

  // Load preview on mount and when filters change
  useEffect(() => {
    if (step === 0) {
      api
        .post<any>('/campaigns/audience-preview', { filters })
        .then(setPreview)
        .catch(() => {});
    }
    if (step === 3) {
      api
        .post<any>('/campaigns/estimate-cost', { filters, channel })
        .then(setCostEstimate)
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, channel]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const campaign = await api.post<any>('/campaigns', {
        name,
        templateId: templateId || undefined,
        filters,
        scheduledAt: scheduleType === 'later' ? scheduledAt : undefined,
        throttlePerMinute: throttle,
        recurrenceRule: recurrenceRule !== 'NONE' ? recurrenceRule : undefined,
        channel,
        ...(isABTest && { isABTest: true, variants }),
      });
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return preview?.count > 0;
    if (step === 1) {
      if (isABTest)
        return variantPercentageSum === 100 && variants.every((v) => v.name && v.content);
      return !!templateId;
    }
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
            <CampaignFilterBuilder
              filters={filters}
              onChange={(newFilters) => {
                setFilters(newFilters);
                // Also update preview count for the step gate
                api
                  .post<any>('/campaigns/audience-preview', { filters: newFilters })
                  .then(setPreview)
                  .catch(() => {});
              }}
            />
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
        <div className="space-y-4">
          {/* A/B Test Toggle */}
          <div className="bg-white rounded-2xl shadow-soft p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical size={16} className="text-lavender-600" />
                <span className="text-sm font-semibold text-slate-900">A/B Test</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isABTest}
                data-testid="ab-test-toggle"
                onClick={() => setIsABTest(!isABTest)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors',
                  isABTest ? 'bg-lavender-500' : 'bg-slate-200',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform mt-0.5',
                    isABTest ? 'translate-x-5.5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>
            {isABTest && (
              <p className="text-xs text-slate-500 mt-2">
                Test different messages to find what works best.
              </p>
            )}
          </div>

          {/* A/B Test Variant Editor */}
          {isABTest && (
            <div className="bg-white rounded-2xl shadow-soft p-5">
              <div className="flex items-center gap-2 mb-4">
                {variants.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setActiveVariant(i)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      activeVariant === i
                        ? 'bg-lavender-100 text-lavender-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                    )}
                  >
                    {v.name}
                  </button>
                ))}
                {variants.length < 3 && (
                  <button
                    onClick={addVariant}
                    data-testid="add-variant-btn"
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                )}
              </div>

              {/* Active variant editor */}
              {variants[activeVariant] && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={variants[activeVariant].name}
                      onChange={(e) => updateVariant(activeVariant, 'name', e.target.value)}
                      placeholder="Variant name"
                      className="flex-1 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-lavender-500"
                    />
                    {variants.length > 2 && (
                      <button
                        onClick={() => removeVariant(activeVariant)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <textarea
                      id={`variant-content-${activeVariant}`}
                      value={variants[activeVariant].content}
                      onChange={(e) => updateVariant(activeVariant, 'content', e.target.value)}
                      placeholder="Message content for this variant... Use {{name}} for personalization"
                      rows={4}
                      data-testid="variant-content"
                      className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-lavender-500 resize-none"
                    />
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-slate-400">Insert:</span>
                      {MERGE_VARIABLES.map((mv) => (
                        <button
                          key={mv.value}
                          type="button"
                          onClick={() => {
                            const ta = document.getElementById(
                              `variant-content-${activeVariant}`,
                            ) as HTMLTextAreaElement | null;
                            if (ta) {
                              const start = ta.selectionStart;
                              const end = ta.selectionEnd;
                              const current = variants[activeVariant].content;
                              const newContent =
                                current.substring(0, start) + mv.value + current.substring(end);
                              updateVariant(activeVariant, 'content', newContent);
                            } else {
                              updateVariant(
                                activeVariant,
                                'content',
                                variants[activeVariant].content + mv.value,
                              );
                            }
                          }}
                          className="px-1.5 py-0.5 text-xs bg-lavender-50 text-lavender-700 rounded hover:bg-lavender-100 transition-colors"
                        >
                          {mv.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Live preview */}
                  {variants[activeVariant].content &&
                    variants[activeVariant].content.includes('{{') && (
                      <div className="bg-sage-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-slate-500 mb-1">Preview:</p>
                        <p className="text-sm text-slate-700">
                          {variants[activeVariant].content
                            .replace(/\{\{name\}\}/gi, 'Sarah')
                            .replace(/\{\{service\}\}/gi, 'Facial Treatment')
                            .replace(/\{\{business\}\}/gi, 'Glow Clinic')
                            .replace(/\{\{date\}\}/gi, 'March 28, 2026')
                            .replace(/\{\{staff\}\}/gi, 'Dr. Chen')}
                        </p>
                      </div>
                    )}
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Audience percentage</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={variants[activeVariant].percentage}
                      onChange={(e) =>
                        updateVariant(activeVariant, 'percentage', Number(e.target.value))
                      }
                      data-testid="variant-percentage"
                      className="w-20 text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-lavender-500"
                    />
                    <span className="text-xs text-slate-400 ml-1">%</span>
                  </div>
                </div>
              )}

              {/* Percentage sum validation */}
              {variantPercentageSum !== 100 && (
                <div
                  data-testid="percentage-error"
                  className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2"
                >
                  Percentages must sum to 100% (currently {variantPercentageSum}%)
                </div>
              )}
            </div>
          )}

          {/* Template selection (used when NOT A/B testing, or for non-AB campaigns) */}
          {!isABTest && (
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
        </div>
      )}

      {/* Step 2: Schedule */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-soft p-5 space-y-4">
          {/* Channel Selection */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Delivery Channel</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  value: 'WHATSAPP',
                  label: 'WhatsApp',
                  active: 'border-sage-400 bg-sage-50 text-sage-700',
                },
                { value: 'SMS', label: 'SMS', active: 'border-blue-400 bg-blue-50 text-blue-700' },
                {
                  value: 'EMAIL',
                  label: 'Email',
                  active: 'border-lavender-400 bg-lavender-50 text-lavender-700',
                },
                {
                  value: 'MULTI',
                  label: 'Multi-channel',
                  active: 'border-amber-400 bg-amber-50 text-amber-700',
                },
              ].map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => setChannel(ch.value)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium border transition-colors text-center',
                    channel === ch.value
                      ? ch.active
                      : 'border-slate-100 text-slate-500 hover:bg-slate-50',
                  )}
                >
                  {ch.label}
                </button>
              ))}
            </div>
            {channel === 'MULTI' && (
              <p className="text-xs text-slate-400 mt-2">
                Messages will be sent via each customer&apos;s preferred or available channel.
              </p>
            )}
          </div>

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

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Repeat campaign</label>
            <select
              value={recurrenceRule}
              onChange={(e) => setRecurrenceRule(e.target.value)}
              className="w-full text-sm bg-slate-50 border-transparent rounded-xl px-3 py-2 focus:bg-white focus:ring-2 focus:ring-sage-500"
            >
              <option value="NONE">No repeat</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            {recurrenceRule !== 'NONE' && (
              <p className="text-xs text-slate-400 mt-1">
                A new campaign will be automatically created after each send completes.
              </p>
            )}
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
                <dt className="text-slate-500">Channel</dt>
                <dd className="font-medium">
                  {{ WHATSAPP: 'WhatsApp', SMS: 'SMS', EMAIL: 'Email', MULTI: 'Multi-channel' }[
                    channel
                  ] || channel}
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
              {recurrenceRule !== 'NONE' && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Recurrence</dt>
                  <dd className="font-medium">
                    {
                      {
                        DAILY: 'Daily',
                        WEEKLY: 'Weekly',
                        BIWEEKLY: 'Bi-weekly',
                        MONTHLY: 'Monthly',
                      }[recurrenceRule]
                    }
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Cost estimation */}
          {costEstimate && (
            <div className="bg-white rounded-2xl shadow-soft p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-2">Estimated Cost</h2>
              {costEstimate.isFree ? (
                <p className="text-sm text-sage-700">No additional cost (included in plan)</p>
              ) : (
                <p className="text-sm text-slate-700">
                  <span className="text-lg font-serif font-bold">
                    ${costEstimate.estimatedCost}
                  </span>
                  <span className="text-slate-500 ml-1">
                    for {costEstimate.audienceSize} messages via {costEstimate.channel}
                  </span>
                </p>
              )}
            </div>
          )}

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
