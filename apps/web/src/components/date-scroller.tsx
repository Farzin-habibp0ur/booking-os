'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface DateScrollerProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
}

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function generateDays(center: Date, range: number): Date[] {
  const days: Date[] = [];
  for (let i = -range; i <= range; i++) {
    const d = new Date(center);
    d.setDate(center.getDate() + i);
    days.push(d);
  }
  return days;
}

export function DateScroller({ currentDate, onDateSelect }: DateScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLButtonElement>(null);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  useEffect(() => {
    if (centerRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = centerRef.current;
      const scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'instant' });
    }
  }, [today]);

  if (!today) {
    return (
      <div className="flex overflow-x-auto gap-2 px-4 py-2 scrollbar-hide">
        {Array.from({ length: 15 }, (_, i) => (
          <div key={i} className="flex-shrink-0 w-12 h-16 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const days = generateDays(today, 7);

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-auto gap-2 px-4 py-2 scrollbar-hide snap-x snap-mandatory"
    >
      {days.map((day) => {
        const isToday = isSameDay(day, today);
        const isSelected = isSameDay(day, currentDate);
        const isCenter = isSameDay(day, currentDate);

        return (
          <button
            key={day.toISOString()}
            ref={isCenter ? centerRef : undefined}
            type="button"
            onClick={() => onDateSelect(day)}
            className={cn(
              'flex-shrink-0 w-12 h-16 rounded-xl flex flex-col items-center justify-center snap-center transition-colors',
              isToday && 'bg-sage-600 text-white',
              isSelected && !isToday && 'bg-sage-50 ring-2 ring-sage-600',
              !isToday && !isSelected && 'hover:bg-slate-50',
            )}
          >
            <span className={cn('text-xs', isToday ? 'text-white/80' : 'text-slate-500')}>
              {DAY_ABBREVS[day.getDay()]}
            </span>
            <span className="text-sm font-semibold">{day.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
