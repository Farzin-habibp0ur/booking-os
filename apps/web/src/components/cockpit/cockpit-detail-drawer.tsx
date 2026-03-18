'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X,
  Bug,
  Link2,
  FileText,
  Calendar,
  MessageSquare,
  Target,
  User,
  AlertTriangle,
  ExternalLink,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import type { CockpitTask } from './daily-tasks-panel';

interface ResolvedEntity {
  type: string;
  id: string;
  label: string;
  status?: string;
  url?: string;
  details?: Record<string, unknown>;
}

interface TaskDetailData {
  taskId: string;
  title: string;
  description: string;
  resolvedEntities: ResolvedEntity[];
}

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

const TYPE_LABELS: Record<string, string> = {
  JIRA_ISSUE: 'Jira Issue',
  COMMITMENT: 'Commitment',
  DOCUMENT: 'Document',
  MEETING: 'Meeting',
  SLACK_THREAD: 'Slack Thread',
  EMAIL: 'Email',
  ROCK: 'Rock',
  PERSON: 'Person',
  DRIFT_ALERT: 'Drift Alert',
};

interface CockpitDetailDrawerProps {
  task: CockpitTask | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CockpitDetailDrawer({ task, isOpen, onClose }: CockpitDetailDrawerProps) {
  const [detail, setDetail] = useState<TaskDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!task) return;

    setLoading(true);
    try {
      const data = (await api.post(
        `/cockpit/daily-tasks/${task.id}/detail`,
        {
          linkedEntities: task.linkedEntities,
          title: task.title,
          description: task.description,
        },
      )) as TaskDetailData;
      setDetail(data);
    } catch {
      // Fall back to showing unresolved entities
      setDetail({
        taskId: task.id,
        title: task.title,
        description: task.description,
        resolvedEntities: task.linkedEntities.map((e) => ({
          type: e.type,
          id: e.id,
          label: e.label,
          status: e.status,
          url: e.url,
        })),
      });
    } finally {
      setLoading(false);
    }
  }, [task]);

  useEffect(() => {
    if (isOpen && task) {
      fetchDetail();
    } else {
      setDetail(null);
    }
  }, [isOpen, task, fetchDetail]);

  if (!isOpen || !task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 animate-backdrop"
        onClick={onClose}
        data-testid="cockpit-drawer-backdrop"
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 animate-slide-in-right overflow-y-auto"
        data-testid="cockpit-detail-drawer"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Task Detail</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            data-testid="cockpit-drawer-close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Title & Description */}
          <div>
            <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">
              {task.title}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{task.description}</p>
          </div>

          {/* Action Items */}
          {task.actionItems.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
                Action Items
              </h4>
              <div className="space-y-2">
                {task.actionItems.map((item, i) => {
                  const Icon = item.entityType
                    ? ENTITY_ICONS[item.entityType] || Circle
                    : Circle;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                      data-testid="drawer-action-item"
                    >
                      <Icon size={14} className="text-slate-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{item.label}</p>
                        {item.entityId && (
                          <span className="text-[10px] text-lavender-600 font-mono">
                            {item.entityId}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked Entities — resolved */}
          {loading ? (
            <div className="space-y-2">
              <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
                Related Entities
              </h4>
              {[1, 2].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-50 animate-pulse" />
              ))}
            </div>
          ) : (
            detail &&
            detail.resolvedEntities.length > 0 && (
              <div>
                <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
                  Related Entities
                </h4>
                <div className="space-y-2">
                  {detail.resolvedEntities.map((entity, i) => {
                    const Icon = ENTITY_ICONS[entity.type] || Circle;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800"
                        data-testid="drawer-entity"
                      >
                        <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <Icon size={14} className="text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                            {entity.label}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400">
                              {TYPE_LABELS[entity.type] || entity.type}
                            </span>
                            {entity.status && (
                              <span className="text-[10px] text-slate-500 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 rounded">
                                {entity.status}
                              </span>
                            )}
                          </div>
                        </div>
                        {entity.url && (
                          <a
                            href={entity.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-lavender-500 hover:text-lavender-700 hover:bg-lavender-50 transition-colors"
                            data-testid={`entity-link-${i}`}
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* Evidence */}
          {task.evidenceRefs && task.evidenceRefs.length > 0 && (
            <div>
              <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">
                Evidence
              </h4>
              <ul className="space-y-1">
                {task.evidenceRefs.map((ref, i) => (
                  <li key={i} className="text-xs text-slate-500 dark:text-slate-400 pl-2 border-l-2 border-slate-100">
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
