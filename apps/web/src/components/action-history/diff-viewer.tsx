'use client';

interface DiffViewerProps {
  before?: any;
  after?: any;
}

export function DiffViewer({ before, after }: DiffViewerProps) {
  if (!before && !after) return null;

  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  return (
    <div data-testid="diff-viewer" className="space-y-2">
      {[...allKeys].map((key) => {
        const prev = before?.[key];
        const next = after?.[key];
        const changed = JSON.stringify(prev) !== JSON.stringify(next);

        return (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="font-mono text-slate-500 w-28 truncate">{key}</span>
            {prev !== undefined && (
              <span
                className={`px-2 py-0.5 rounded ${
                  changed ? 'bg-red-50 text-red-700 line-through' : 'bg-slate-50 text-slate-600'
                }`}
                data-testid={`diff-before-${key}`}
              >
                {typeof prev === 'object' ? JSON.stringify(prev) : String(prev)}
              </span>
            )}
            {changed && next !== undefined && (
              <>
                <span className="text-slate-300">&rarr;</span>
                <span
                  className="px-2 py-0.5 rounded bg-sage-50 text-sage-700"
                  data-testid={`diff-after-${key}`}
                >
                  {typeof next === 'object' ? JSON.stringify(next) : String(next)}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
