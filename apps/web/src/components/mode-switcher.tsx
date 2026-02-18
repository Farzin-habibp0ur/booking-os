'use client';

import { useMode } from '@/lib/use-mode';
import { usePack } from '@/lib/vertical-pack';
import { getModeLabel } from '@/lib/mode-config';
import { cn } from '@/lib/cn';

export default function ModeSwitcher() {
  const { mode, setMode, availableModes } = useMode();
  const pack = usePack();

  // Hide when only one mode available (e.g. SERVICE_PROVIDER)
  if (availableModes.length <= 1) return null;

  return (
    <div
      className="flex gap-1 px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
      role="tablist"
      aria-label="App mode"
    >
      {availableModes.map((m) => (
        <button
          key={m.key}
          role="tab"
          aria-selected={mode === m.key}
          onClick={() => setMode(m.key)}
          className={cn(
            'flex-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-200',
            mode === m.key
              ? 'bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-400 shadow-sm'
              : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300',
          )}
        >
          {getModeLabel(m.key, pack.name)}
        </button>
      ))}
    </div>
  );
}
