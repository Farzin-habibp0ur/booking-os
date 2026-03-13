import { cn } from '@/lib/cn';
import { Search, Edit3, FileText, Eye, Send, BarChart3 } from 'lucide-react';

const PIPELINE_STAGES = [
  { key: 'research', label: 'Research', icon: Search },
  { key: 'creation', label: 'Creation', icon: Edit3 },
  { key: 'queue', label: 'Queue', icon: FileText },
  { key: 'approve', label: 'Approve', icon: Eye },
  { key: 'publish', label: 'Publish', icon: Send },
  { key: 'analyze', label: 'Analyze', icon: BarChart3 },
] as const;

export interface PipelineStageCounts {
  research: number;
  creation: number;
  queue: number;
  approve: number;
  publish: number;
  analyze: number;
}

interface PipelineVisualizationProps {
  stageCounts: PipelineStageCounts;
  activeStage?: string;
  className?: string;
}

export function PipelineVisualization({
  stageCounts,
  activeStage,
  className,
}: PipelineVisualizationProps) {
  return (
    <div
      data-testid="pipeline-visualization"
      className={cn(
        'rounded-2xl bg-white p-5 shadow-soft border border-slate-100',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        {PIPELINE_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const count = stageCounts[stage.key] || 0;
          const isActive = activeStage === stage.key;
          return (
            <div key={stage.key} className="flex items-center flex-1">
              <div
                className={cn('flex flex-col items-center flex-1', isActive && 'scale-105')}
                data-testid={`stage-${stage.key}`}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center mb-1.5',
                    isActive
                      ? 'bg-lavender-100 text-lavender-700'
                      : 'bg-slate-100 text-slate-500',
                  )}
                >
                  <Icon size={18} />
                </div>
                <p
                  className={cn(
                    'text-[11px] font-medium',
                    isActive ? 'text-lavender-700' : 'text-slate-600',
                  )}
                >
                  {stage.label}
                </p>
                <p
                  className={cn(
                    'text-lg font-bold',
                    isActive ? 'text-lavender-700' : 'text-slate-900',
                  )}
                  data-testid={`count-${stage.key}`}
                >
                  {count}
                </p>
              </div>
              {idx < PIPELINE_STAGES.length - 1 && (
                <div className="w-8 h-px bg-slate-200 flex-shrink-0 mx-1" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
