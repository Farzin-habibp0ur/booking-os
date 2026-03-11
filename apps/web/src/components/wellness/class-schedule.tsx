'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Users, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { apiFetch } from '@/lib/api';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface ClassItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  maxParticipants: number;
  date: string;
  enrollmentCount: number;
  spotsRemaining: number;
  service: { id: string; name: string; durationMins: number; price: number };
  staff: { id: string; name: string };
  resource?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
}

interface ClassScheduleProps {
  onEnroll?: (classId: string) => void;
  portalMode?: boolean;
  fetchFn?: (path: string) => Promise<any>;
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1 - 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export default function ClassSchedule({ onEnroll, portalMode, fetchFn }: ClassScheduleProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStr = getISOWeek(currentWeek);
  const fetcher = fetchFn || apiFetch;

  useEffect(() => {
    setLoading(true);
    const endpoint = portalMode
      ? `/portal/class-schedule?week=${weekStr}`
      : `/recurring-classes/schedule?week=${weekStr}`;

    fetcher(endpoint)
      .then((data: ClassItem[]) => setClasses(Array.isArray(data) ? data : []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, [weekStr, portalMode, fetcher]);

  // Group classes by day of week
  const byDay: Record<number, ClassItem[]> = {};
  for (const cls of classes) {
    const dayIdx = cls.dayOfWeek === 0 ? 6 : cls.dayOfWeek - 1; // Mon=0..Sun=6
    if (!byDay[dayIdx]) byDay[dayIdx] = [];
    byDay[dayIdx].push(cls);
  }

  return (
    <div data-testid="class-schedule">
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentWeek(addWeeks(currentWeek, -1))}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Previous week"
        >
          <ChevronLeft size={18} className="text-slate-500" />
        </button>
        <span className="text-sm font-medium text-slate-700">Week {weekStr}</span>
        <button
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Next week"
        >
          <ChevronRight size={18} className="text-slate-500" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          No classes scheduled this week
        </div>
      ) : (
        <div className="space-y-4">
          {DAY_NAMES.map((day, i) => {
            const dayClasses = byDay[i];
            if (!dayClasses || dayClasses.length === 0) return null;
            return (
              <div key={day}>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                  {day}
                </h4>
                <div className="space-y-2">
                  {dayClasses.map((cls) => {
                    const isFull = cls.spotsRemaining <= 0;
                    return (
                      <div
                        key={cls.id + cls.date}
                        className={cn(
                          'bg-white rounded-xl border p-3',
                          isFull ? 'border-slate-200 opacity-75' : 'border-sage-200',
                        )}
                        data-testid="class-card"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {cls.service.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {cls.startTime} · {cls.service.durationMins}min
                              </span>
                              <span className="flex items-center gap-1">
                                <Users size={12} />
                                {cls.enrollmentCount}/{cls.maxParticipants}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                              <span>with {cls.staff.name}</span>
                              {cls.location && (
                                <span className="flex items-center gap-0.5">
                                  <MapPin size={10} />
                                  {cls.location.name}
                                </span>
                              )}
                            </div>
                          </div>
                          {onEnroll && (
                            <button
                              onClick={() => onEnroll(cls.id)}
                              disabled={isFull}
                              className={cn(
                                'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                                isFull
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                  : 'bg-sage-600 text-white hover:bg-sage-700',
                              )}
                            >
                              {isFull ? 'Full' : `Book (${cls.spotsRemaining} left)`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
