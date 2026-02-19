'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

interface RecommendedSlotsProps {
  serviceId: string;
  date: string;
  excludeBookingId?: string;
  onSelect: (slot: { time: string; staffId: string; staffName: string }) => void;
}

export default function RecommendedSlots({
  serviceId,
  date,
  excludeBookingId,
  onSelect,
}: RecommendedSlotsProps) {
  const [slots, setSlots] = useState<
    { time: string; display: string; staffId: string; staffName: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serviceId || !date) return;
    setLoading(true);
    const params = new URLSearchParams({ serviceId, date });
    if (excludeBookingId) params.set('excludeBookingId', excludeBookingId);
    api
      .get<typeof slots>(`/availability/recommended-slots?${params}`)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [serviceId, date, excludeBookingId]);

  if (loading) return null;
  if (slots.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1 mb-1.5">
        <Sparkles size={12} className="text-lavender-500" />
        <span className="text-xs font-medium text-lavender-700">Recommended times</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {slots.map((slot) => (
          <button
            key={`${slot.time}-${slot.staffId}`}
            type="button"
            onClick={() => onSelect(slot)}
            className={cn(
              'px-2.5 py-1 rounded-xl text-xs font-medium',
              'bg-lavender-50 text-lavender-700 border border-lavender-100',
              'hover:bg-lavender-100 transition-colors',
            )}
          >
            {slot.display} · {slot.staffName.split(' ')[0]}
          </button>
        ))}
      </div>
    </div>
  );
}
