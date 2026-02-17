'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TooltipNudgeProps {
  id: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom';
  className?: string;
}

function getDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('tooltip-dismissed') || '[]');
  } catch {
    return [];
  }
}

function dismiss(id: string) {
  const dismissed = getDismissed();
  if (!dismissed.includes(id)) {
    localStorage.setItem('tooltip-dismissed', JSON.stringify([...dismissed, id]));
  }
}

export default function TooltipNudge({
  id,
  title,
  description,
  position = 'bottom',
  className,
}: TooltipNudgeProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = getDismissed();
    if (!dismissed.includes(id)) {
      setVisible(true);
    }
  }, [id]);

  if (!visible) return null;

  const handleDismiss = () => {
    dismiss(id);
    setVisible(false);
  };

  return (
    <div
      className={cn(
        'relative bg-lavender-50 border border-lavender-100 rounded-xl p-3 text-sm',
        position === 'top' && 'mb-3',
        position === 'bottom' && 'mt-3',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-lavender-900">{title}</p>
          <p className="text-xs text-lavender-700 mt-0.5">{description}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-lavender-400 hover:text-lavender-600 flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>
      <button
        onClick={handleDismiss}
        className="text-xs text-lavender-600 hover:text-lavender-800 mt-2 underline"
      >
        Got it, don&apos;t show again
      </button>
    </div>
  );
}

export function useTooltip(id: string) {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const dismissed = getDismissed();
    setShouldShow(!dismissed.includes(id));
  }, [id]);

  return {
    shouldShow,
    dismiss: () => {
      dismiss(id);
      setShouldShow(false);
    },
  };
}
