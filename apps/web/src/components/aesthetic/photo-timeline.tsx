'use client';

import { useMemo } from 'react';
import { Camera, Clock } from 'lucide-react';
import { cn } from '@/lib/cn';

interface TimelinePhoto {
  id: string;
  type: string;
  bodyArea: string;
  fileUrl: string;
  thumbnailUrl?: string;
  notes?: string;
  takenAt: string;
  booking?: { id: string; startTime: string; service?: { name: string } } | null;
  takenBy?: { id: string; name: string } | null;
}

interface PhotoTimelineProps {
  photos: TimelinePhoto[];
  onPhotoClick?: (photo: TimelinePhoto) => void;
}

const TYPE_DOT: Record<string, string> = {
  BEFORE: 'bg-amber-400',
  AFTER: 'bg-sage-500',
  PROGRESS: 'bg-lavender-500',
};

export function PhotoTimeline({ photos, onPhotoClick }: PhotoTimelineProps) {
  // Group by bodyArea, then sort each group chronologically
  const grouped = useMemo(() => {
    const map = new Map<string, TimelinePhoto[]>();
    for (const p of photos) {
      const existing = map.get(p.bodyArea) || [];
      existing.push(p);
      map.set(p.bodyArea, existing);
    }
    // Sort each group chronologically (oldest first)
    for (const [, items] of map) {
      items.sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
    }
    return map;
  }, [photos]);

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">No photos in timeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="photo-timeline">
      {[...grouped.entries()].map(([bodyArea, areaPhotos]) => (
        <div key={bodyArea}>
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
            <Camera size={12} />
            {bodyArea.charAt(0).toUpperCase() + bodyArea.slice(1)}
            <span className="text-slate-400 font-normal">({areaPhotos.length})</span>
          </h4>

          <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
            {areaPhotos.map((photo) => {
              const dotColor = TYPE_DOT[photo.type] || TYPE_DOT.PROGRESS;
              return (
                <div key={photo.id} className="relative group" data-testid="timeline-entry">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'absolute -left-[25px] top-2 w-3 h-3 rounded-full border-2 border-white',
                      dotColor,
                    )}
                  />

                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div
                      className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0 cursor-pointer hover:ring-2 hover:ring-sage-400 transition-all"
                      onClick={() => onPhotoClick?.(photo)}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.fileUrl}
                        alt={`${photo.type} — ${photo.bodyArea}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            photo.type === 'BEFORE'
                              ? 'bg-amber-50 text-amber-700'
                              : photo.type === 'AFTER'
                                ? 'bg-sage-50 text-sage-700'
                                : 'bg-lavender-50 text-lavender-700',
                          )}
                        >
                          {photo.type}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(photo.takenAt).toLocaleDateString()}{' '}
                          {new Date(photo.takenAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {photo.notes && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{photo.notes}</p>
                      )}
                      {photo.booking?.service?.name && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {photo.booking.service.name}
                        </p>
                      )}
                      {photo.takenBy?.name && (
                        <p className="text-[10px] text-slate-400">by {photo.takenBy.name}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
