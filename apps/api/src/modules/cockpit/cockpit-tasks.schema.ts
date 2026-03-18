// Cockpit task schema — structured output for LLM-generated daily tasks
// Uses TypeScript interfaces + runtime validation (no Zod dependency)

export const ENTITY_TYPES = [
  'JIRA_ISSUE',
  'COMMITMENT',
  'DOCUMENT',
  'MEETING',
  'SLACK_THREAD',
  'EMAIL',
  'ROCK',
  'DRIFT_ALERT',
] as const;

export const LINKED_ENTITY_TYPES = [...ENTITY_TYPES, 'PERSON'] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
export type LinkedEntityType = (typeof LINKED_ENTITY_TYPES)[number];

export interface ActionItem {
  label: string;
  entityType?: EntityType;
  entityId?: string;
  entityLabel?: string;
}

export interface LinkedEntity {
  type: LinkedEntityType;
  id: string;
  label: string;
  status?: string;
}

export interface CockpitTaskSchema {
  title: string;
  description: string;
  priority: 'URGENT_TODAY' | 'NEEDS_APPROVAL' | 'OPPORTUNITY' | 'HYGIENE';
  category: string;
  actionItems: ActionItem[];
  linkedEntities: LinkedEntity[];
  evidenceRefs?: string[];
  qualityFlag?: 'SPECIFIC' | 'VAGUE';
}

export interface CockpitTasksOutput {
  tasks: CockpitTaskSchema[];
  generatedAt: string;
}

// ---- Runtime validation ----

const PRIORITIES = ['URGENT_TODAY', 'NEEDS_APPROVAL', 'OPPORTUNITY', 'HYGIENE'];

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function validateActionItem(item: unknown): item is ActionItem {
  if (!item || typeof item !== 'object') return false;
  const a = item as Record<string, unknown>;
  if (!isNonEmptyString(a.label)) return false;
  if (a.entityType !== undefined && !ENTITY_TYPES.includes(a.entityType as EntityType))
    return false;
  return true;
}

function validateLinkedEntity(entity: unknown): entity is LinkedEntity {
  if (!entity || typeof entity !== 'object') return false;
  const e = entity as Record<string, unknown>;
  if (!LINKED_ENTITY_TYPES.includes(e.type as LinkedEntityType)) return false;
  if (!isNonEmptyString(e.id)) return false;
  if (!isNonEmptyString(e.label)) return false;
  return true;
}

export function validateCockpitTask(raw: unknown): CockpitTaskSchema | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;

  if (!isNonEmptyString(t.title)) return null;
  if (!isNonEmptyString(t.description)) return null;
  if (!PRIORITIES.includes(t.priority as string)) return null;
  if (!isNonEmptyString(t.category)) return null;

  const actionItems = Array.isArray(t.actionItems)
    ? (t.actionItems as unknown[]).filter(validateActionItem)
    : [];
  if (actionItems.length === 0) return null;
  if (actionItems.length > 5) actionItems.length = 5;

  const linkedEntities = Array.isArray(t.linkedEntities)
    ? (t.linkedEntities as unknown[]).filter(validateLinkedEntity)
    : [];

  const evidenceRefs = Array.isArray(t.evidenceRefs)
    ? (t.evidenceRefs as unknown[]).filter(isNonEmptyString)
    : undefined;

  return {
    title: t.title as string,
    description: t.description as string,
    priority: t.priority as CockpitTaskSchema['priority'],
    category: t.category as string,
    actionItems,
    linkedEntities,
    evidenceRefs: evidenceRefs?.length ? evidenceRefs : undefined,
    qualityFlag: undefined, // Set by validation pass
  };
}

export function validateCockpitTasksOutput(raw: unknown): CockpitTasksOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.tasks)) return null;

  const tasks = (o.tasks as unknown[])
    .map(validateCockpitTask)
    .filter((t): t is CockpitTaskSchema => t !== null);

  if (tasks.length === 0) return null;

  return {
    tasks,
    generatedAt: typeof o.generatedAt === 'string' ? o.generatedAt : new Date().toISOString(),
  };
}
