'use client';

import { useState, useCallback } from 'react';
import {
  MessageSquare,
  Clock,
  GitBranch,
  Tag,
  ArrowRight,
  Plus,
  X,
  ChevronDown,
} from 'lucide-react';

export interface AutomationStepData {
  id: string;
  order: number;
  type: 'ACTION' | 'DELAY' | 'BRANCH';
  config: Record<string, any>;
  parentStepId?: string;
  branchLabel?: string;
}

interface AutomationStepBuilderProps {
  steps: AutomationStepData[];
  onChange: (steps: AutomationStepData[]) => void;
}

const STEP_TYPE_OPTIONS = [
  {
    type: 'ACTION' as const,
    actionType: 'SEND_MESSAGE',
    label: 'Send Message',
    icon: MessageSquare,
  },
  { type: 'DELAY' as const, actionType: undefined, label: 'Wait', icon: Clock },
  { type: 'BRANCH' as const, actionType: undefined, label: 'Condition', icon: GitBranch },
  {
    type: 'ACTION' as const,
    actionType: 'UPDATE_STATUS',
    label: 'Update Status',
    icon: ArrowRight,
  },
  { type: 'ACTION' as const, actionType: 'ADD_TAG', label: 'Add Tag', icon: Tag },
];

function getStepIcon(step: AutomationStepData) {
  if (step.type === 'DELAY') return Clock;
  if (step.type === 'BRANCH') return GitBranch;
  const actionType = step.config?.actionType;
  if (actionType === 'ADD_TAG') return Tag;
  if (actionType === 'UPDATE_STATUS') return ArrowRight;
  return MessageSquare;
}

function getStepLabel(step: AutomationStepData): string {
  if (step.type === 'DELAY') {
    const mins = step.config?.delayMinutes || 0;
    if (mins >= 60) return `Wait ${Math.round(mins / 60)}h`;
    return `Wait ${mins}m`;
  }
  if (step.type === 'BRANCH') {
    const field = step.config?.field || '';
    const op = step.config?.operator || '';
    const val = step.config?.value || '';
    if (field) return `If ${field} ${op} ${val}`;
    return 'Condition';
  }
  const actionType = step.config?.actionType || 'SEND_MESSAGE';
  switch (actionType) {
    case 'SEND_MESSAGE':
      return step.config?.template ? `Send: ${step.config.template.slice(0, 30)}` : 'Send Message';
    case 'UPDATE_STATUS':
      return step.config?.newStatus ? `Set status: ${step.config.newStatus}` : 'Update Status';
    case 'ADD_TAG':
      return step.config?.tag ? `Add tag: ${step.config.tag}` : 'Add Tag';
    default:
      return actionType;
  }
}

let stepIdCounter = 0;
function generateStepId(): string {
  stepIdCounter++;
  return `step-${stepIdCounter}-${Date.now()}`;
}

function StepConfigEditor({
  step,
  onUpdate,
}: {
  step: AutomationStepData;
  onUpdate: (config: Record<string, any>) => void;
}) {
  if (step.type === 'DELAY') {
    return (
      <div className="mt-2 flex items-center gap-2">
        <label className="text-xs text-slate-500">Minutes:</label>
        <input
          type="number"
          value={step.config?.delayMinutes || 0}
          onChange={(e) => onUpdate({ ...step.config, delayMinutes: Number(e.target.value) })}
          className="w-20 text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-2 py-1"
          data-testid="step-delay-input"
          min={0}
        />
      </div>
    );
  }

  if (step.type === 'BRANCH') {
    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Field (e.g. status)"
            value={step.config?.field || ''}
            onChange={(e) => onUpdate({ ...step.config, field: e.target.value })}
            className="flex-1 text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-2 py-1"
            data-testid="step-branch-field"
          />
          <select
            value={step.config?.operator || 'is'}
            onChange={(e) => onUpdate({ ...step.config, operator: e.target.value })}
            className="text-sm bg-slate-50 border-transparent rounded-lg px-2 py-1"
            aria-label="Branch operator"
            data-testid="step-branch-operator"
          >
            <option value="is">is</option>
            <option value="isNot">is not</option>
            <option value="gt">greater than</option>
            <option value="lt">less than</option>
          </select>
          <input
            type="text"
            placeholder="Value"
            value={step.config?.value || ''}
            onChange={(e) => onUpdate({ ...step.config, value: e.target.value })}
            className="flex-1 text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-2 py-1"
            data-testid="step-branch-value"
          />
        </div>
      </div>
    );
  }

  // ACTION type
  const actionType = step.config?.actionType || 'SEND_MESSAGE';
  if (actionType === 'SEND_MESSAGE') {
    return (
      <div className="mt-2 space-y-1">
        <input
          type="text"
          placeholder="Message template..."
          value={step.config?.template || ''}
          onChange={(e) => onUpdate({ ...step.config, template: e.target.value })}
          className="w-full text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-2 py-1"
          data-testid="step-message-template"
        />
        <select
          value={step.config?.channel || 'sms'}
          onChange={(e) => onUpdate({ ...step.config, channel: e.target.value })}
          className="text-sm bg-slate-50 border-transparent rounded-lg px-2 py-1"
          aria-label="Message channel"
          data-testid="step-message-channel"
        >
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </div>
    );
  }
  if (actionType === 'UPDATE_STATUS') {
    return (
      <div className="mt-2">
        <select
          value={step.config?.newStatus || ''}
          onChange={(e) => onUpdate({ ...step.config, newStatus: e.target.value })}
          className="text-sm bg-slate-50 border-transparent rounded-lg px-2 py-1"
          aria-label="New status"
          data-testid="step-status-select"
        >
          <option value="">Select status...</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No Show</option>
        </select>
      </div>
    );
  }
  if (actionType === 'ADD_TAG') {
    return (
      <div className="mt-2">
        <input
          type="text"
          placeholder="Tag name..."
          value={step.config?.tag || ''}
          onChange={(e) => onUpdate({ ...step.config, tag: e.target.value })}
          className="w-full text-sm bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-lg px-2 py-1"
          data-testid="step-tag-input"
        />
      </div>
    );
  }
  return null;
}

export function AutomationStepBuilder({ steps, onChange }: AutomationStepBuilderProps) {
  const [addMenuIndex, setAddMenuIndex] = useState<number | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const addStep = useCallback(
    (insertIndex: number, option: (typeof STEP_TYPE_OPTIONS)[number]) => {
      const newStep: AutomationStepData = {
        id: generateStepId(),
        order: insertIndex,
        type: option.type,
        config: option.actionType ? { actionType: option.actionType } : {},
      };

      // Reorder existing steps
      const newSteps = [...steps];
      newSteps.splice(insertIndex, 0, newStep);
      const reordered = newSteps.map((s, i) => ({ ...s, order: i }));
      onChange(reordered);
      setAddMenuIndex(null);
      setExpandedStepId(newStep.id);
    },
    [steps, onChange],
  );

  const removeStep = useCallback(
    (stepId: string) => {
      const newSteps = steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i }));
      onChange(newSteps);
      if (expandedStepId === stepId) setExpandedStepId(null);
    },
    [steps, onChange, expandedStepId],
  );

  const updateStepConfig = useCallback(
    (stepId: string, config: Record<string, any>) => {
      const newSteps = steps.map((s) => (s.id === stepId ? { ...s, config } : s));
      onChange(newSteps);
    },
    [steps, onChange],
  );

  return (
    <div className="relative" data-testid="automation-step-builder">
      {/* Empty state */}
      {steps.length === 0 && (
        <div className="text-center py-8" data-testid="step-builder-empty">
          <p className="text-sm text-slate-400 mb-3">No steps yet. Add your first step.</p>
          <div className="relative inline-block">
            <button
              onClick={() => setAddMenuIndex(0)}
              className="w-8 h-8 rounded-full bg-sage-50 border border-sage-200 hover:bg-sage-100 flex items-center justify-center transition-colors mx-auto"
              data-testid="add-step-button-empty"
              aria-label="Add first step"
            >
              <Plus size={14} className="text-sage-600" />
            </button>
            {addMenuIndex === 0 && (
              <AddStepMenu
                onSelect={(option) => addStep(0, option)}
                onClose={() => setAddMenuIndex(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* Step list */}
      {steps.map((step, index) => {
        const Icon = getStepIcon(step);
        const label = getStepLabel(step);
        const isExpanded = expandedStepId === step.id;

        return (
          <div key={step.id}>
            {/* Add button before this step */}
            {index === 0 && (
              <div className="flex justify-center mb-2 relative">
                <button
                  onClick={() => setAddMenuIndex(0)}
                  className="w-8 h-8 rounded-full bg-sage-50 border border-sage-200 hover:bg-sage-100 flex items-center justify-center transition-colors"
                  data-testid={`add-step-button-${index}`}
                  aria-label="Add step before"
                >
                  <Plus size={14} className="text-sage-600" />
                </button>
                {addMenuIndex === 0 && (
                  <AddStepMenu
                    onSelect={(option) => addStep(0, option)}
                    onClose={() => setAddMenuIndex(null)}
                  />
                )}
              </div>
            )}

            {/* Timeline connector */}
            {index > 0 && (
              <div className="flex justify-center">
                <div className="w-0.5 h-4 bg-slate-200" />
              </div>
            )}

            {/* Step card */}
            <div
              className="bg-white rounded-xl border border-slate-200 p-4 relative"
              data-testid={`step-card-${step.id}`}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                    <Icon size={16} className="text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-800">{label}</span>
                    {step.type === 'DELAY' && (
                      <span
                        className="ml-2 bg-amber-50 text-amber-700 text-xs rounded-full px-2 py-0.5"
                        data-testid="delay-badge"
                      >
                        {step.config?.delayMinutes || 0}m delay
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </div>
                <button
                  onClick={() => removeStep(step.id)}
                  className="ml-2 p-1 text-slate-400 hover:text-red-500 transition-colors"
                  data-testid={`remove-step-${step.id}`}
                  aria-label="Remove step"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Expanded config editor */}
              {isExpanded && (
                <div data-testid={`step-config-${step.id}`}>
                  <StepConfigEditor
                    step={step}
                    onUpdate={(config) => updateStepConfig(step.id, config)}
                  />
                </div>
              )}
            </div>

            {/* Add button after this step */}
            <div className="flex justify-center mt-2 relative">
              <div className="flex flex-col items-center">
                {index < steps.length - 1 && <div className="w-0.5 h-2 bg-slate-200" />}
                <button
                  onClick={() => setAddMenuIndex(index + 1)}
                  className="w-8 h-8 rounded-full bg-sage-50 border border-sage-200 hover:bg-sage-100 flex items-center justify-center transition-colors"
                  data-testid={`add-step-button-${index + 1}`}
                  aria-label="Add step after"
                >
                  <Plus size={14} className="text-sage-600" />
                </button>
                {addMenuIndex === index + 1 && (
                  <AddStepMenu
                    onSelect={(option) => addStep(index + 1, option)}
                    onClose={() => setAddMenuIndex(null)}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddStepMenu({
  onSelect,
  onClose,
}: {
  onSelect: (option: (typeof STEP_TYPE_OPTIONS)[number]) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20 w-48"
        data-testid="add-step-menu"
      >
        {STEP_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={`${option.type}-${option.actionType || 'default'}`}
              onClick={() => onSelect(option)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              data-testid={`add-step-option-${option.label.replace(/\s/g, '-').toLowerCase()}`}
            >
              <Icon size={14} className="text-slate-500" />
              {option.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
