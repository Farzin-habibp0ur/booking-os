'use client';

import { ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SortableHeaderProps {
  label: string;
  column: string;
  currentSort: string | null;
  currentOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  column,
  currentSort,
  currentOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSort === column;

  return (
    <button
      onClick={() => onSort(column)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium uppercase tracking-wide cursor-pointer select-none transition-colors hover:text-sage-600',
        isActive ? 'text-sage-700' : 'text-slate-500',
        className,
      )}
    >
      {label}
      {isActive ? (
        currentOrder === 'desc' ? (
          <ArrowDown size={14} className="text-sage-600" />
        ) : (
          <ArrowUp size={14} className="text-sage-600" />
        )
      ) : (
        <ArrowUpDown size={14} className="text-slate-300" />
      )}
    </button>
  );
}
