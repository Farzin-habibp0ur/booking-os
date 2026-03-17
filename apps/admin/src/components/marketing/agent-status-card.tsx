import { cn } from '@/lib/cn';
import {
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  TrendingUp,
  FileText,
  Send,
  BarChart3,
} from 'lucide-react';

export const AGENT_CATEGORY_STYLES: Record<string, string> = {
  content: 'bg-lavender-50 text-lavender-700',
  distribution: 'bg-blue-50 text-blue-700',
  analytics: 'bg-amber-50 text-amber-700',
};

export const AGENT_CATEGORY_LABELS: Record<string, string> = {
  content: 'Content',
  distribution: 'Distribution',
  analytics: 'Analytics',
};

interface AgentStatusCardProps {
  agentType: string;
  name: string;
  description?: string;
  category: 'content' | 'distribution' | 'analytics';
  isEnabled: boolean;
  runIntervalMinutes?: number;
  performanceScore?: number;
  latestRun?: {
    status: string;
    cardsCreated: number;
  };
  onToggle: () => void;
  onRunNow: () => void;
  onClick?: () => void;
  isTriggering?: boolean;
}

function formatInterval(minutes?: number) {
  if (!minutes) return 'Manual';
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function AgentStatusCard({
  agentType,
  name,
  category,
  isEnabled,
  runIntervalMinutes,
  performanceScore,
  latestRun,
  onToggle,
  onRunNow,
  onClick,
  isTriggering = false,
}: AgentStatusCardProps) {
  const score = performanceScore;

  const CategoryIcon =
    category === 'content' ? FileText : category === 'distribution' ? Send : BarChart3;
  const categoryIconColor =
    category === 'content'
      ? 'text-lavender-600'
      : category === 'distribution'
        ? 'text-blue-600'
        : 'text-amber-600';
  const categoryBg =
    category === 'content'
      ? 'bg-lavender-50'
      : category === 'distribution'
        ? 'bg-blue-50'
        : 'bg-amber-50';

  return (
    <div
      data-testid="agent-status-card"
      className="rounded-2xl border bg-white shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', categoryBg)}>
            <CategoryIcon size={18} className={categoryIconColor} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900">{name}</h3>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  AGENT_CATEGORY_STYLES[category],
                )}
                data-testid="category-badge"
              >
                {AGENT_CATEGORY_LABELS[category]}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                Every {formatInterval(runIntervalMinutes)}
              </span>
              {score != null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-medium',
                    score >= 80 ? 'text-sage-600' : score >= 50 ? 'text-amber-600' : 'text-red-500',
                  )}
                  data-testid="performance-score"
                >
                  <TrendingUp size={12} />
                  {Math.round(score)}%
                </span>
              )}
              {latestRun && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    latestRun.status === 'COMPLETED'
                      ? 'text-sage-600'
                      : latestRun.status === 'FAILED'
                        ? 'text-red-500'
                        : 'text-slate-400',
                  )}
                  data-testid="last-run-status"
                >
                  {latestRun.status === 'COMPLETED' ? (
                    <CheckCircle2 size={12} />
                  ) : latestRun.status === 'FAILED' ? (
                    <XCircle size={12} />
                  ) : (
                    <Zap size={12} />
                  )}
                  {latestRun.status === 'COMPLETED'
                    ? `${latestRun.cardsCreated} created`
                    : latestRun.status}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRunNow();
            }}
            disabled={!isEnabled || isTriggering}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5',
              isEnabled
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-50 text-slate-300 cursor-not-allowed',
            )}
            data-testid="run-now-btn"
          >
            <Play size={14} />
            {isTriggering ? 'Running...' : 'Run Now'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              isEnabled ? 'bg-sage-500' : 'bg-slate-200',
            )}
            data-testid="toggle-btn"
            role="switch"
            aria-checked={isEnabled}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                isEnabled ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
