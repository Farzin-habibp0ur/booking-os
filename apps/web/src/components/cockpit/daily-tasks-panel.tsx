'use client';

import { useState } from 'react';
import {
  Bug,
  Link2,
  FileText,
  Calendar,
  MessageSquare,
  Target,
  User,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  Circle,
  Sparkles,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// ---- Types matching backend CockpitTask ----

export interface CockpitActionItem {
  label: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
}

export interface CockpitLinkedEntity {
  type: string;
  id: string;
  label: string;
  status?: string;
  url?: string;
}

export interface CockpitTask {
  id: string;
  title: string;
  description: string;
  priority: 'URGENT_TODAY' | 'NEEDS_APPROVAL' | 'OPPORTUNITY' | 'HYGIENE';
  category: string;
  actionItems: CockpitActionItem[];
  linkedEntities: CockpitLinkedEntity[];
  evidenceRefs?: string[];
  qualityFlag?: 'SPECIFIC' | 'VAGUE';
}

// ---- Icon maps ----

const ENTITY_ICONS: Record<string, typeof Bug> = {
  JIRA_ISSUE: Bug,
  COMMITMENT: Link2,
  DOCUMENT: FileText,
  MEETING: Calendar,
  SLACK_THREAD: MessageSquare,
  EMAIL: MessageSquare,
  ROCK: Target,
  PERSON: User,
  DRIFT_ALERT: AlertTriangle,
};

const PRIORITY_STYLES: Record<string, { border: string; badge: string; badgeText: string }> = {
  URGENT_TODAY: {
    border: 'border-l-red-400',
    badge: 'bg-red-50 text-red-700',
    badgeText: 'Urgent',
  },
  NEEDS_APPROVAL: {
    border: 'border-l-lavender-400',
    badge: 'bg-lavender-50 text-lavender-700',
    badgeText: 'Approval',
  },
  OPPORTUNITY: {
    border: 'border-l-sage-400',
    badge: 'bg-sage-50 text-sage-700',
    badgeText: 'Opportunity',
  },
  HYGIENE: {
    border: 'border-l-slate-300',
    badge: 'bg-slate-50 text-slate-600',
    badgeText: 'Hygiene',
  },
};

// ---- Subcomponents ----

function ActionItemRow({ item }: { item: CockpitActionItem }) {
  const Icon = item.entityType ? ENTITY_ICONS[item.entityType] || Circle : Circle;
  const isJira = item.entityType === 'JIRA_ISSUE' && item.entityId;

  return (
    <div className="flex items-start gap-2 py-0.5" data-testid="action-item">
      <Icon size={13} className="text-slate-400 mt-0.5 shrink-0" />
      <span className="text-xs text-slate-700 dark:text-slate-300">
        {item.label}
        {isJira && (
          <code className="ml-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono text-lavender-600">
            {item.entityId}
          </code>
        )}
      </span>
    </div>
  );
}

function LinkedEntityChip({ entity }: { entity: CockpitLinkedEntity }) {
  const Icon = ENTITY_ICONS[entity.type] || Circle;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400"
      data-testid="linked-entity"
    >
      <Icon size={10} className="shrink-0" />
      <span className="truncate max-w-[120px]">{entity.label}</span>
      {entity.status && (
        <span className="text-slate-400 dark:text-slate-500">· {entity.status}</span>
      )}
      {entity.url && (
        <a
          href={entity.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lavender-500 hover:text-lavender-700"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={9} />
        </a>
      )}
    </span>
  );
}

// ---- Main task card ----

interface TaskCardProps {
  task: CockpitTask;
  onViewDetail?: (task: CockpitTask) => void;
}

function TaskCard({ task, onViewDetail }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.HYGIENE;

  return (
    <div
      data-testid={`cockpit-task-${task.id}`}
      className={cn(
        'rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800',
        'border-l-4 p-4 transition-all hover:shadow-soft',
        style.border,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', style.badge)}>
              {style.badgeText}
            </span>
            {task.qualityFlag === 'VAGUE' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600">
                Low specificity
              </span>
            )}
          </div>
          <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {task.description}
          </p>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded-lg text-slate-300 hover:text-slate-500 transition-colors shrink-0"
          data-testid={`cockpit-expand-${task.id}`}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Action Items — always visible */}
      {task.actionItems.length > 0 && (
        <div className="mt-3 space-y-0.5" data-testid="action-items-list">
          {task.actionItems.slice(0, expanded ? 5 : 2).map((item, i) => (
            <ActionItemRow key={i} item={item} />
          ))}
          {!expanded && task.actionItems.length > 2 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] text-lavender-500 hover:text-lavender-700 ml-5"
            >
              +{task.actionItems.length - 2} more
            </button>
          )}
        </div>
      )}

      {/* Linked Entities — always visible */}
      {task.linkedEntities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1" data-testid="linked-entities-list">
          {task.linkedEntities.slice(0, expanded ? undefined : 3).map((entity, i) => (
            <LinkedEntityChip key={i} entity={entity} />
          ))}
          {!expanded && task.linkedEntities.length > 3 && (
            <span className="text-[10px] text-slate-400 self-center">
              +{task.linkedEntities.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
          {task.evidenceRefs && task.evidenceRefs.length > 0 && (
            <div className="mb-2">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Evidence
              </span>
              <ul className="mt-1 space-y-0.5">
                {task.evidenceRefs.map((ref, i) => (
                  <li key={i} className="text-[10px] text-slate-500 pl-2">
                    · {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onViewDetail && (
            <button
              onClick={() => onViewDetail(task)}
              className="flex items-center gap-1 text-xs text-lavender-600 hover:text-lavender-700 transition-colors"
              data-testid={`cockpit-detail-${task.id}`}
            >
              <Sparkles size={12} /> View full details
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Panel ----

interface DailyTasksPanelProps {
  tasks: CockpitTask[];
  loading?: boolean;
  onViewDetail?: (task: CockpitTask) => void;
}

export function DailyTasksPanel({ tasks, loading, onViewDetail }: DailyTasksPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3" data-testid="cockpit-tasks-loading">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 animate-pulse"
          >
            <div className="h-3 w-16 bg-slate-100 rounded mb-2" />
            <div className="h-4 w-3/4 bg-slate-100 rounded mb-1" />
            <div className="h-3 w-full bg-slate-50 rounded mb-3" />
            <div className="space-y-1">
              <div className="h-3 w-2/3 bg-slate-50 rounded" />
              <div className="h-3 w-1/2 bg-slate-50 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        className="text-center py-8 text-slate-400 dark:text-slate-500"
        data-testid="cockpit-tasks-empty"
      >
        <CheckCircle2 size={32} className="mx-auto mb-2 text-sage-400" />
        <p className="text-sm font-medium">All clear for today</p>
        <p className="text-xs mt-1">No tasks requiring attention right now.</p>
      </div>
    );
  }

  // Group by priority
  const grouped = {
    URGENT_TODAY: tasks.filter((t) => t.priority === 'URGENT_TODAY'),
    NEEDS_APPROVAL: tasks.filter((t) => t.priority === 'NEEDS_APPROVAL'),
    OPPORTUNITY: tasks.filter((t) => t.priority === 'OPPORTUNITY'),
    HYGIENE: tasks.filter((t) => t.priority === 'HYGIENE'),
  };

  const sections = [
    {
      key: 'URGENT_TODAY',
      label: 'Urgent Today',
      icon: AlertTriangle,
      tasks: grouped.URGENT_TODAY,
    },
    { key: 'NEEDS_APPROVAL', label: 'Needs Approval', icon: Clock, tasks: grouped.NEEDS_APPROVAL },
    { key: 'OPPORTUNITY', label: 'Opportunities', icon: Target, tasks: grouped.OPPORTUNITY },
    { key: 'HYGIENE', label: 'Hygiene', icon: CheckCircle2, tasks: grouped.HYGIENE },
  ].filter((s) => s.tasks.length > 0);

  return (
    <div className="space-y-4" data-testid="cockpit-tasks-panel">
      {sections.map((section) => (
        <div key={section.key}>
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <section.icon size={12} className="text-slate-400" />
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              {section.label} ({section.tasks.length})
            </span>
          </div>
          <div className="space-y-2">
            {section.tasks.map((task) => (
              <TaskCard key={task.id} task={task} onViewDetail={onViewDetail} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
