'use client';

import { useState, useRef, useEffect } from 'react';
import { Clock, X, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ScheduledMessageProps {
  onSchedule: (date: Date) => void;
  onClear: () => void;
  scheduledAt: Date | null;
}

function getNextMonday9AM(): Date {
  const d = new Date();
  const daysUntilMonday = ((8 - d.getDay()) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

function getTomorrow(hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function getInHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

const QUICK_PRESETS = [
  { label: 'In 1 hour', getDate: () => getInHours(1) },
  { label: 'In 3 hours', getDate: () => getInHours(3) },
  { label: 'Tomorrow 9 AM', getDate: () => getTomorrow(9) },
  { label: 'Tomorrow 12 PM', getDate: () => getTomorrow(12) },
  { label: 'Monday 9 AM', getDate: getNextMonday9AM },
];

export default function ScheduledMessage({
  onSchedule,
  onClear,
  scheduledAt,
}: ScheduledMessageProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    if (showPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPopover]);

  const handleSchedule = () => {
    if (!selectedDate || !selectedTime) return;
    const dateTime = new Date(`${selectedDate}T${selectedTime}`);
    onSchedule(dateTime);
    setShowPopover(false);
    setSelectedDate('');
    setSelectedTime('09:00');
  };

  const handlePreset = (date: Date) => {
    onSchedule(date);
    setShowPopover(false);
  };

  const formatScheduledTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="relative" data-testid="scheduled-message">
      <button
        onClick={() => setShowPopover(!showPopover)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors border',
          scheduledAt
            ? 'border-sage-500 bg-sage-50 text-sage-700 hover:bg-sage-100'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50',
        )}
        data-testid="schedule-toggle"
      >
        <Clock size={14} />
        {scheduledAt ? 'Scheduled' : 'Schedule'}
      </button>

      {scheduledAt && (
        <div className="flex items-center gap-2 mt-2" data-testid="schedule-badge">
          <span className="text-xs bg-sage-100 text-sage-700 px-2 py-1 rounded-full">
            Sending {formatScheduledTime(scheduledAt)}
          </span>
          <button
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-slate-600"
            aria-label="Clear scheduled time"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {showPopover && (
        <div
          ref={popoverRef}
          className="absolute bottom-full mb-2 left-0 w-80 bg-white rounded-xl shadow-soft border border-slate-200 p-4 z-50"
          data-testid="schedule-popover"
        >
          <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
            <CalendarDays size={14} />
            Schedule Message
          </h3>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.getDate())}
                className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-sage-100 hover:text-sage-700 transition-colors"
                data-testid={`preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDate}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Time</label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
              >
                {Array.from({ length: 96 }, (_, i) => {
                  const h = Math.floor(i / 4);
                  const m = (i % 4) * 15;
                  const val = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                  const label = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  });
                  return (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSchedule}
                disabled={!selectedDate || !selectedTime}
                className="flex-1 px-3 py-2 bg-sage-600 text-white rounded-lg text-sm font-medium hover:bg-sage-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Schedule
              </button>
              <button
                onClick={() => {
                  setShowPopover(false);
                  setSelectedDate('');
                  setSelectedTime('09:00');
                }}
                className="flex-1 px-3 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
