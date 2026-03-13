import { cn } from '@/lib/cn';

export interface PillarData {
  pillar: string;
  actual: number;
  target: number;
}

interface PillarBalanceChartProps {
  data: PillarData[];
  className?: string;
}

export function PillarBalanceChart({ data, className }: PillarBalanceChartProps) {
  return (
    <div
      data-testid="pillar-balance-chart"
      className={cn(
        'rounded-2xl bg-white shadow-soft p-5 border border-slate-100',
        className,
      )}
    >
      <h3 className="font-serif text-sm font-semibold text-slate-900 mb-4">
        Pillar Balance
      </h3>
      <div className="space-y-3">
        {data.map(({ pillar, actual, target }) => {
          const diff = actual - target;
          const color =
            Math.abs(diff) <= 5 ? 'balanced' : diff > 0 ? 'over' : 'under';
          return (
            <div key={pillar} data-testid="pillar-row">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-700">{pillar}</span>
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    color === 'balanced' && 'text-green-600',
                    color === 'over' && 'text-amber-600',
                    color === 'under' && 'text-red-600',
                  )}
                  data-testid="pillar-percent"
                >
                  {Math.round(actual)}% / {target}%
                </span>
              </div>
              <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    color === 'balanced' && 'bg-green-500',
                    color === 'over' && 'bg-amber-500',
                    color === 'under' && 'bg-red-400',
                  )}
                  style={{ width: `${Math.min(actual, 100)}%` }}
                  data-testid="pillar-bar"
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                  style={{ left: `${target}%` }}
                  data-testid="pillar-target-marker"
                />
              </div>
            </div>
          );
        })}
      </div>
      {data.length > 0 && (
        <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
          Bars show actual %. Markers show ideal target.
        </p>
      )}
    </div>
  );
}
