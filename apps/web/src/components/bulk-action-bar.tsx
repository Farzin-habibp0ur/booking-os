'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger';
  }>;
}

export default function BulkActionBar({ count, onClear, actions }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-lg px-5 py-3 flex items-center gap-4 animate-slide-in-from-bottom">
      <span className="text-sm font-medium">{count} selected</span>
      <div className="w-px h-5 bg-slate-700" />
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={
              action.variant === 'danger'
                ? 'text-sm px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 transition-colors'
                : 'text-sm px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors'
            }
          >
            {action.label}
          </button>
        ))}
      </div>
      <button onClick={onClear} className="text-slate-400 hover:text-white transition-colors ml-1">
        <X size={16} />
      </button>
    </div>
  );
}
