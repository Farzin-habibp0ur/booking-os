'use client';

import { Suspense, useReducer, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ArrowLeft, Save, PlayCircle, AlertTriangle } from 'lucide-react';
import { WorkflowCanvas } from '@/components/workflow/workflow-canvas';
import { WorkflowSidebar } from '@/components/workflow/workflow-sidebar';
import { NodeConfigModal } from '@/components/workflow/node-config-modal';
import type { WorkflowNodeData } from '@/components/workflow/workflow-node';
import type { Connection } from '@/components/workflow/workflow-connector';
import { serializeWorkflow } from './serialize-workflow';
import { AutomationStepBuilder, type AutomationStepData } from '@/components/automation-step-builder';

// --- State ---

interface WorkflowState {
  nodes: WorkflowNodeData[];
  connections: Connection[];
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
  zoom: number;
  pan: { x: number; y: number };
  name: string;
  isSaving: boolean;
  isTesting: boolean;
  error: string | null;
  toast: string | null;
}

type Action =
  | { type: 'ADD_NODE'; node: WorkflowNodeData }
  | { type: 'DELETE_NODE'; id: string }
  | { type: 'UPDATE_NODE_CONFIG'; id: string; config: Record<string, any> }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'ADD_CONNECTION'; connection: Connection }
  | { type: 'DELETE_CONNECTION'; id: string }
  | { type: 'SELECT_CONNECTION'; id: string | null }
  | { type: 'SET_ZOOM'; delta: number }
  | { type: 'SET_PAN'; x: number; y: number }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_SAVING'; value: boolean }
  | { type: 'SET_TESTING'; value: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_TOAST'; toast: string | null }
  | { type: 'LOAD_WORKFLOW'; nodes: WorkflowNodeData[]; connections: Connection[]; name: string };

const initialState: WorkflowState = {
  nodes: [],
  connections: [],
  selectedNodeId: null,
  selectedConnectionId: null,
  zoom: 1,
  pan: { x: 0, y: 0 },
  name: '',
  isSaving: false,
  isTesting: false,
  error: null,
  toast: null,
};

function reducer(state: WorkflowState, action: Action): WorkflowState {
  switch (action.type) {
    case 'ADD_NODE':
      return { ...state, nodes: [...state.nodes, action.node] };
    case 'DELETE_NODE':
      return {
        ...state,
        nodes: state.nodes.filter((n) => n.id !== action.id),
        connections: state.connections.filter(
          (c) => c.fromNodeId !== action.id && c.toNodeId !== action.id,
        ),
        selectedNodeId: state.selectedNodeId === action.id ? null : state.selectedNodeId,
      };
    case 'UPDATE_NODE_CONFIG': {
      const nodes = state.nodes.map((n) =>
        n.id === action.id
          ? { ...n, config: action.config, label: action.config.label || n.label }
          : n,
      );
      return { ...state, nodes };
    }
    case 'SELECT_NODE':
      return { ...state, selectedNodeId: action.id, selectedConnectionId: null };
    case 'ADD_CONNECTION': {
      // Prevent duplicates
      const exists = state.connections.some(
        (c) =>
          c.fromNodeId === action.connection.fromNodeId &&
          c.toNodeId === action.connection.toNodeId,
      );
      if (exists) return state;
      return { ...state, connections: [...state.connections, action.connection] };
    }
    case 'DELETE_CONNECTION':
      return {
        ...state,
        connections: state.connections.filter((c) => c.id !== action.id),
        selectedConnectionId: null,
      };
    case 'SELECT_CONNECTION':
      return { ...state, selectedConnectionId: action.id, selectedNodeId: null };
    case 'SET_ZOOM': {
      const newZoom = Math.max(0.5, Math.min(2, state.zoom + action.delta));
      return { ...state, zoom: newZoom };
    }
    case 'SET_PAN':
      return { ...state, pan: { x: action.x, y: action.y } };
    case 'SET_NAME':
      return { ...state, name: action.name };
    case 'SET_SAVING':
      return { ...state, isSaving: action.value };
    case 'SET_TESTING':
      return { ...state, isTesting: action.value };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_TOAST':
      return { ...state, toast: action.toast };
    case 'LOAD_WORKFLOW':
      return { ...state, nodes: action.nodes, connections: action.connections, name: action.name };
    default:
      return state;
  }
}

// --- Serialization ---

// Map visual trigger subtypes to API trigger strings
// --- Deserialization ---

function deserializeRule(rule: any): {
  nodes: WorkflowNodeData[];
  connections: Connection[];
  name: string;
} {
  const nodes: WorkflowNodeData[] = [];
  const connections: Connection[] = [];
  let y = 40;

  // Trigger node
  const triggerSubtype = rule.trigger || 'BOOKING_CREATED';
  const triggerNode: WorkflowNodeData = {
    id: 'trigger-1',
    type: 'TRIGGER',
    subtype: triggerSubtype,
    label: TRIGGER_LABELS[triggerSubtype] || triggerSubtype,
    config: { ...rule.filters },
    x: 200,
    y,
  };
  nodes.push(triggerNode);
  y += 100;

  // Condition nodes from filters
  const conditionFilters = ['newStatus', 'tag', 'minAmount', 'serviceKind', 'staffName'];
  let prevId = triggerNode.id;
  for (const key of conditionFilters) {
    if (rule.filters?.[key]) {
      const condId = `cond-${key}`;
      const condNode: WorkflowNodeData = {
        id: condId,
        type: 'CONDITION',
        subtype: FILTER_TO_CONDITION[key] || 'IF_STATUS',
        label: CONDITION_LABELS[key] || key,
        config: { [FILTER_TO_CONFIG[key] || key]: rule.filters[key] },
        x: 200,
        y,
      };
      nodes.push(condNode);
      connections.push({ id: `conn-${prevId}-${condId}`, fromNodeId: prevId, toNodeId: condId });
      prevId = condId;
      y += 100;
    }
  }

  // Action nodes
  const ruleActions = Array.isArray(rule.actions) ? rule.actions : [];
  for (let i = 0; i < ruleActions.length; i++) {
    const act = ruleActions[i];
    const actId = `action-${i}`;

    // Delay node if action has delayHours
    if (act.delayHours) {
      const delayId = `delay-${i}`;
      nodes.push({
        id: delayId,
        type: 'DELAY',
        subtype: 'WAIT_HOURS',
        label: `Wait ${act.delayHours}h`,
        config: { duration: act.delayHours, unit: 'hours' },
        x: 200,
        y,
      });
      connections.push({ id: `conn-${prevId}-${delayId}`, fromNodeId: prevId, toNodeId: delayId });
      prevId = delayId;
      y += 100;
    }

    const subtype = ACTION_REVERSE_MAP[act.type] || 'SEND_TEMPLATE';
    const config: Record<string, any> = {};
    if (act.category) config.category = act.category;
    if (act.value) {
      if (act.type === 'ADD_TAG') config.tag = act.value;
      else if (act.type === 'UPDATE_STATUS') config.status = act.value;
      else if (act.type === 'ASSIGN_STAFF') config.staffId = act.value;
    }
    if (act.params) Object.assign(config, act.params);

    nodes.push({
      id: actId,
      type: 'ACTION',
      subtype,
      label: ACTION_LABELS[subtype] || act.type,
      config,
      x: 200,
      y,
    });
    connections.push({ id: `conn-${prevId}-${actId}`, fromNodeId: prevId, toNodeId: actId });
    prevId = actId;
    y += 100;
  }

  return { nodes, connections, name: rule.name || '' };
}

const TRIGGER_LABELS: Record<string, string> = {
  BOOKING_CREATED: 'New Booking',
  BOOKING_CANCELLED: 'Booking Cancelled',
  STATUS_CHANGED: 'Status Changed',
  BOOKING_UPCOMING: 'Time-Based',
};

const CONDITION_LABELS: Record<string, string> = {
  newStatus: 'If Status Is',
  tag: 'If Tag Contains',
  minAmount: 'If Amount > X',
  serviceKind: 'If Service Is',
  staffName: 'If Staff Is',
};

const FILTER_TO_CONDITION: Record<string, string> = {
  newStatus: 'IF_STATUS',
  tag: 'IF_TAG',
  minAmount: 'IF_AMOUNT',
  serviceKind: 'IF_SERVICE',
  staffName: 'IF_STAFF',
};

const FILTER_TO_CONFIG: Record<string, string> = {
  newStatus: 'status',
  tag: 'tag',
  minAmount: 'amount',
  serviceKind: 'service',
  staffName: 'staff',
};

const ACTION_REVERSE_MAP: Record<string, string> = {
  SEND_TEMPLATE: 'SEND_TEMPLATE',
  UPDATE_STATUS: 'UPDATE_STATUS',
  ASSIGN_STAFF: 'ASSIGN_STAFF',
  ADD_TAG: 'ADD_TAG',
  SEND_NOTIFICATION: 'SEND_NOTIFICATION',
};

const ACTION_LABELS: Record<string, string> = {
  SEND_TEMPLATE: 'Send Message',
  SEND_EMAIL: 'Send Email',
  UPDATE_STATUS: 'Update Status',
  ASSIGN_STAFF: 'Assign Staff',
  ADD_TAG: 'Add Tag',
  SEND_NOTIFICATION: 'Send WhatsApp',
  CREATE_ACTION_CARD: 'Create Action Card',
};

const BLOCK_LABELS: Record<string, string> = {
  BOOKING_CREATED: 'New Booking',
  BOOKING_CANCELLED: 'Booking Cancelled',
  CUSTOMER_CREATED: 'Customer Created',
  MESSAGE_RECEIVED: 'Message Received',
  STATUS_CHANGED: 'Status Changed',
  BOOKING_UPCOMING: 'Time-Based',
  IF_STATUS: 'If Status Is',
  IF_TAG: 'If Tag Contains',
  IF_TIME_SINCE: 'If Time Since > X',
  IF_AMOUNT: 'If Amount > X',
  IF_SERVICE: 'If Service Is',
  IF_STAFF: 'If Staff Is',
  SEND_TEMPLATE: 'Send Message',
  SEND_EMAIL: 'Send Email',
  CREATE_ACTION_CARD: 'Create Action Card',
  UPDATE_STATUS: 'Update Status',
  ASSIGN_STAFF: 'Assign Staff',
  ADD_TAG: 'Add Tag',
  SEND_NOTIFICATION: 'Send WhatsApp',
  WAIT_MINUTES: 'Wait Minutes',
  WAIT_HOURS: 'Wait Hours',
  WAIT_UNTIL: 'Wait Until',
};

// --- Page Component ---

let nodeIdCounter = 0;

export default function WorkflowBuilderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-400">Loading builder...</div>}>
      <WorkflowBuilderContent />
    </Suspense>
  );
}

function WorkflowBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ruleId = searchParams.get('ruleId');
  const [state, dispatch] = useReducer(reducer, initialState);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<'visual' | 'steps'>('visual');
  const [automationSteps, setAutomationSteps] = useState<AutomationStepData[]>([]);

  // Load existing rule
  useEffect(() => {
    if (ruleId) {
      api
        .get<any>(`/automations/rules`)
        .then((rules: any[]) => {
          const rule = rules.find((r: any) => r.id === ruleId);
          if (rule) {
            const { nodes, connections, name } = deserializeRule(rule);
            dispatch({ type: 'LOAD_WORKFLOW', nodes, connections, name });
          }
        })
        .catch(() => dispatch({ type: 'SET_ERROR', error: 'Failed to load rule' }));

      // P-13: Load steps
      api
        .get<any[]>(`/automations/rules/${ruleId}/steps`)
        .then((steps: any[]) => {
          if (steps && steps.length > 0) {
            setAutomationSteps(
              steps.map((s: any) => ({
                id: s.id,
                order: s.order,
                type: s.type,
                config: s.config || {},
                parentStepId: s.parentStepId || undefined,
                branchLabel: s.branchLabel || undefined,
              })),
            );
            setBuilderMode('steps');
          }
        })
        .catch(() => {});
    }
  }, [ruleId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (state.toast) {
      const timer = setTimeout(() => dispatch({ type: 'SET_TOAST', toast: null }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.toast]);

  const handleAddNode = useCallback((block: any, x: number, y: number) => {
    nodeIdCounter++;
    const node: WorkflowNodeData = {
      id: `node-${nodeIdCounter}-${Date.now()}`,
      type: block.type,
      subtype: block.subtype,
      label: BLOCK_LABELS[block.subtype] || block.label || block.subtype,
      config: {},
      x,
      y,
    };
    dispatch({ type: 'ADD_NODE', node });
  }, []);

  const handleAddConnection = useCallback((fromNodeId: string, toNodeId: string) => {
    const id = `conn-${fromNodeId}-${toNodeId}`;
    dispatch({ type: 'ADD_CONNECTION', connection: { id, fromNodeId, toNodeId } });
  }, []);

  const handleSave = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', error: null });

    // P-13: If in steps mode, save steps
    if (builderMode === 'steps' && ruleId) {
      dispatch({ type: 'SET_SAVING', value: true });
      try {
        await api.put(`/automations/rules/${ruleId}/steps`, {
          steps: automationSteps.map((s) => ({
            order: s.order,
            type: s.type,
            config: s.config,
            parentStepId: s.parentStepId,
            branchLabel: s.branchLabel,
          })),
        });
        dispatch({ type: 'SET_TOAST', toast: 'Steps saved successfully' });
      } catch (err) {
        dispatch({ type: 'SET_ERROR', error: 'Failed to save steps' });
      }
      dispatch({ type: 'SET_SAVING', value: false });
      return;
    }

    const result = serializeWorkflow(state);

    if (result.error) {
      dispatch({ type: 'SET_ERROR', error: result.error });
      return;
    }

    dispatch({ type: 'SET_SAVING', value: true });
    try {
      if (ruleId) {
        await api.patch(`/automations/rules/${ruleId}`, result.data);
      } else {
        await api.post('/automations/rules', result.data);
      }
      dispatch({ type: 'SET_TOAST', toast: 'Workflow saved successfully' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to save workflow' });
    }
    dispatch({ type: 'SET_SAVING', value: false });
  }, [state, ruleId, builderMode, automationSteps]);

  const handleTest = useCallback(async () => {
    dispatch({ type: 'SET_ERROR', error: null });
    const result = serializeWorkflow(state);

    if (result.error) {
      dispatch({ type: 'SET_ERROR', error: result.error });
      return;
    }

    dispatch({ type: 'SET_TESTING', value: true });
    try {
      // If editing existing rule, test it
      if (ruleId) {
        const testResult = await api.post<any>(`/automations/rules/${ruleId}/test`, {});
        dispatch({
          type: 'SET_TOAST',
          toast: `Test: ${testResult.matched || 0} matched, ${testResult.skipped || 0} skipped`,
        });
      } else {
        dispatch({ type: 'SET_TOAST', toast: 'Save the workflow first to test it' });
      }
    } catch {
      dispatch({ type: 'SET_ERROR', error: 'Test failed' });
    }
    dispatch({ type: 'SET_TESTING', value: false });
  }, [state, ruleId]);

  const configNode = configNodeId ? state.nodes.find((n) => n.id === configNodeId) || null : null;

  return (
    <div className="h-full flex flex-col" data-testid="workflow-builder">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/automations')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <input
            type="text"
            value={state.name}
            onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })}
            placeholder="Workflow name..."
            className="text-sm font-medium bg-transparent border-none outline-none w-64 placeholder:text-slate-300"
            data-testid="workflow-name-input"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={state.isTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <PlayCircle size={14} />
            {state.isTesting ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={handleSave}
            disabled={state.isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
            data-testid="workflow-save"
          >
            <Save size={14} />
            {state.isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Error / Toast */}
      {state.error && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 text-sm border-b border-red-100"
          data-testid="workflow-error"
        >
          <AlertTriangle size={14} />
          {state.error}
        </div>
      )}
      {state.toast && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-sage-50 text-sage-700 text-sm border-b border-sage-100"
          data-testid="workflow-toast"
        >
          {state.toast}
        </div>
      )}

      {/* P-13: Builder mode toggle */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setBuilderMode('visual')}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
            builderMode === 'visual'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
          data-testid="mode-visual"
        >
          Visual Builder
        </button>
        <button
          onClick={() => setBuilderMode('steps')}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
            builderMode === 'steps'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
          data-testid="mode-steps"
        >
          Step Sequence
        </button>
      </div>

      {/* Main content: sidebar + canvas or step builder */}
      {builderMode === 'steps' ? (
        <div className="flex-1 overflow-auto p-6 bg-slate-50/50" data-testid="step-builder-panel">
          <div className="max-w-lg mx-auto">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Automation Steps</h3>
            <AutomationStepBuilder steps={automationSteps} onChange={setAutomationSteps} />
          </div>
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
        <WorkflowSidebar />
        <WorkflowCanvas
          nodes={state.nodes}
          connections={state.connections}
          selectedNodeId={state.selectedNodeId}
          selectedConnectionId={state.selectedConnectionId}
          zoom={state.zoom}
          pan={state.pan}
          onSelectNode={(id) => dispatch({ type: 'SELECT_NODE', id })}
          onSelectConnection={(id) => dispatch({ type: 'SELECT_CONNECTION', id })}
          onDeleteNode={(id) => dispatch({ type: 'DELETE_NODE', id })}
          onConfigureNode={(id) => setConfigNodeId(id)}
          onAddNode={handleAddNode}
          onAddConnection={handleAddConnection}
          onZoom={(delta) => dispatch({ type: 'SET_ZOOM', delta })}
          onPan={(x, y) => dispatch({ type: 'SET_PAN', x, y })}
        />
      </div>
      )}

      {/* Node config modal */}
      <NodeConfigModal
        node={configNode}
        isOpen={configNodeId !== null}
        onClose={() => setConfigNodeId(null)}
        onSave={(id, config) => dispatch({ type: 'UPDATE_NODE_CONFIG', id, config })}
      />
    </div>
  );
}
