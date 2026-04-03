import type { WorkflowNodeData } from '@/components/workflow/workflow-node';
import type { Connection } from '@/components/workflow/workflow-connector';

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

const TRIGGER_MAP: Record<string, string> = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  CUSTOMER_CREATED: 'BOOKING_CREATED', // map to closest
  MESSAGE_RECEIVED: 'BOOKING_CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  BOOKING_UPCOMING: 'BOOKING_UPCOMING',
};

// Map visual action subtypes to API action types
const ACTION_TYPE_MAP: Record<string, string> = {
  SEND_TEMPLATE: 'SEND_TEMPLATE',
  SEND_EMAIL: 'SEND_TEMPLATE',
  SEND_NOTIFICATION: 'SEND_NOTIFICATION',
  CREATE_ACTION_CARD: 'SEND_NOTIFICATION',
  UPDATE_STATUS: 'UPDATE_STATUS',
  ASSIGN_STAFF: 'ASSIGN_STAFF',
  ADD_TAG: 'ADD_TAG',
};

export function serializeWorkflow(state: WorkflowState) {
  const triggerNodes = state.nodes.filter((n) => n.type === 'TRIGGER');
  const conditionNodes = state.nodes.filter((n) => n.type === 'CONDITION');
  const actionNodes = state.nodes.filter((n) => n.type === 'ACTION');
  const delayNodes = state.nodes.filter((n) => n.type === 'DELAY');

  if (triggerNodes.length !== 1) {
    return { error: 'Workflow must have exactly 1 trigger' };
  }
  if (actionNodes.length === 0) {
    return { error: 'Workflow must have at least 1 action' };
  }
  if (!state.name.trim()) {
    return { error: 'Please enter a workflow name' };
  }

  const trigger = triggerNodes[0];
  const apiTrigger = TRIGGER_MAP[trigger.subtype] || 'BOOKING_CREATED';

  // Build filters from trigger config + condition nodes
  const filters: Record<string, any> = { ...trigger.config };
  delete filters.label;
  for (const cond of conditionNodes) {
    const c = cond.config;
    if (cond.subtype === 'IF_STATUS' && c.status) filters.newStatus = c.status;
    if (cond.subtype === 'IF_TAG' && c.tag) filters.tag = c.tag;
    if (cond.subtype === 'IF_AMOUNT' && c.amount) filters.minAmount = c.amount;
    if (cond.subtype === 'IF_SERVICE' && c.service) filters.serviceKind = c.service;
    if (cond.subtype === 'IF_STAFF' && c.staff) filters.staffName = c.staff;
    if (cond.subtype === 'IF_TIME_SINCE' && c.timeSince)
      filters.daysSinceLastBooking = Math.round(c.timeSince / 24);
  }

  // Build actions array
  const actions: any[] = [];

  // Add delay info to first action if delay nodes exist
  let delayHours = 0;
  for (const d of delayNodes) {
    const c = d.config;
    if (c.duration && c.unit === 'minutes') delayHours += c.duration / 60;
    else if (c.duration && c.unit === 'hours') delayHours += c.duration;
    else if (c.duration) delayHours += c.duration;
  }

  for (const act of actionNodes) {
    const c = act.config;
    const apiType = ACTION_TYPE_MAP[act.subtype] || 'SEND_TEMPLATE';
    const action: any = { type: apiType };

    if (c.category) action.category = c.category;
    if (c.tag) action.value = c.tag;
    if (c.status) action.value = c.status;
    if (c.staffId) action.value = c.staffId;
    if (c.channel) action.params = { channel: c.channel };
    if (c.title)
      action.params = { ...action.params, title: c.title, description: c.description || '' };

    if (delayHours > 0) {
      action.delayHours = Math.round(delayHours * 100) / 100;
      delayHours = 0; // apply only to first action
    }

    actions.push(action);
  }

  return {
    data: {
      name: state.name.trim(),
      trigger: apiTrigger,
      filters,
      actions,
      quietStart: '21:00',
      quietEnd: '09:00',
      maxPerCustomerPerDay: 3,
    },
  };
}
