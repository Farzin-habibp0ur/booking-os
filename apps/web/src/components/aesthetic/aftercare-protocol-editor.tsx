'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, Clock, MessageSquare } from 'lucide-react';

interface Step {
  sequenceOrder: number;
  delayHours: number;
  channel: string;
  subject: string;
  body: string;
  instructions?: string;
  isActive: boolean;
}

interface Protocol {
  id?: string;
  name: string;
  serviceId?: string | null;
  isDefault: boolean;
  isActive?: boolean;
  steps: Step[];
}

interface Props {
  protocol?: Protocol;
  services?: Array<{ id: string; name: string }>;
  onSave: (data: Omit<Protocol, 'id'>) => void;
  onCancel: () => void;
  saving?: boolean;
}

const CHANNEL_OPTIONS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'BOTH', label: 'WhatsApp + Email' },
];

const TEMPLATE_VARS = [
  '{{customerName}}',
  '{{serviceName}}',
  '{{businessName}}',
  '{{bookingDate}}',
];

export function AftercareProtocolEditor({ protocol, services, onSave, onCancel, saving }: Props) {
  const [name, setName] = useState(protocol?.name || '');
  const [serviceId, setServiceId] = useState(protocol?.serviceId || '');
  const [isDefault, setIsDefault] = useState(protocol?.isDefault || false);
  const [steps, setSteps] = useState<Step[]>(
    protocol?.steps?.length
      ? protocol.steps
      : [
          {
            sequenceOrder: 1,
            delayHours: 0,
            channel: 'WHATSAPP',
            subject: '',
            body: '',
            isActive: true,
          },
        ],
  );

  const addStep = () => {
    const maxOrder = steps.reduce((max, s) => Math.max(max, s.sequenceOrder), 0);
    const lastDelay = steps.length > 0 ? steps[steps.length - 1].delayHours : 0;
    setSteps([
      ...steps,
      {
        sequenceOrder: maxOrder + 1,
        delayHours: lastDelay + 24,
        channel: 'WHATSAPP',
        subject: '',
        body: '',
        isActive: true,
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof Step, value: any) => {
    setSteps(steps.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      serviceId: serviceId || undefined,
      isDefault,
      steps: steps.map((s, i) => ({ ...s, sequenceOrder: i + 1 })),
    });
  };

  const formatDelay = (hours: number): string => {
    if (hours === 0) return 'Immediately';
    if (hours < 24) return `${hours}h after treatment`;
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    if (rem === 0) return `${days} day${days > 1 ? 's' : ''} after treatment`;
    return `${days}d ${rem}h after treatment`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Protocol Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-4 py-2.5"
            placeholder="e.g. General Aesthetic Aftercare"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Service (optional)
          </label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl px-4 py-2.5"
          >
            <option value="">All services (default)</option>
            {services?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded"
        />
        <span className="text-slate-700">
          Default protocol (used when no service-specific protocol exists)
        </span>
      </label>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Steps ({steps.length})</h3>
          <button
            type="button"
            onClick={addStep}
            className="flex items-center gap-1.5 text-sm text-sage-600 hover:text-sage-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Step
          </button>
        </div>

        <div className="text-xs text-slate-500 mb-3">
          Available variables:{' '}
          {TEMPLATE_VARS.map((v) => (
            <code key={v} className="bg-slate-100 px-1 rounded mx-0.5">
              {v}
            </code>
          ))}
        </div>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-white border border-slate-100 rounded-xl p-4 space-y-3"
              data-testid={`aftercare-step-${index}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-medium text-slate-700">Step {index + 1}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDelay(step.delayHours)}
                  </span>
                </div>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="text-red-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Delay (hours)</label>
                  <input
                    type="number"
                    value={step.delayHours}
                    onChange={(e) => updateStep(index, 'delayHours', parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-3 py-2 text-sm"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Channel</label>
                  <select
                    value={step.channel}
                    onChange={(e) => updateStep(index, 'channel', e.target.value)}
                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-3 py-2 text-sm"
                  >
                    {CHANNEL_OPTIONS.map((ch) => (
                      <option key={ch.value} value={ch.value}>
                        {ch.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Subject (email)</label>
                  <input
                    type="text"
                    value={step.subject}
                    onChange={(e) => updateStep(index, 'subject', e.target.value)}
                    className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-3 py-2 text-sm"
                    placeholder="Optional email subject"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Message Body</label>
                <textarea
                  value={step.body}
                  onChange={(e) => updateStep(index, 'body', e.target.value)}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Hi {{customerName}}, ..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Internal Notes (optional)
                </label>
                <input
                  type="text"
                  value={step.instructions || ''}
                  onChange={(e) => updateStep(index, 'instructions', e.target.value)}
                  className="w-full bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-3 py-2 text-sm"
                  placeholder="Staff-only notes about this step"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name || steps.length === 0}
          className="px-5 py-2 text-sm font-medium bg-sage-600 hover:bg-sage-700 text-white rounded-xl btn-press disabled:opacity-50"
        >
          {saving ? 'Saving...' : protocol?.id ? 'Update Protocol' : 'Create Protocol'}
        </button>
      </div>
    </form>
  );
}
