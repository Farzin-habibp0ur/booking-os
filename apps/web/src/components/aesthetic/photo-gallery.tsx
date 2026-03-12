'use client';

import { useState } from 'react';
import { Image, X, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ELEVATION } from '@/lib/design-tokens';

interface ClinicalPhoto {
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

interface PhotoGalleryProps {
  photos: ClinicalPhoto[];
  onDelete?: (photoId: string) => void;
  onSelect?: (photo: ClinicalPhoto) => void;
}

const TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  BEFORE: { bg: 'bg-amber-50', text: 'text-amber-700' },
  AFTER: { bg: 'bg-sage-50', text: 'text-sage-700' },
  PROGRESS: { bg: 'bg-lavender-50', text: 'text-lavender-700' },
};

export function PhotoGallery({ photos, onDelete, onSelect }: PhotoGalleryProps) {
  const [filterType, setFilterType] = useState<string>('');
  const [filterBodyArea, setFilterBodyArea] = useState<string>('');
  const [lightboxPhoto, setLightboxPhoto] = useState<ClinicalPhoto | null>(null);

  const bodyAreas = [...new Set(photos.map((p) => p.bodyArea))].sort();

  const filtered = photos.filter((p) => {
    if (filterType && p.type !== filterType) return false;
    if (filterBodyArea && p.bodyArea !== filterBodyArea) return false;
    return true;
  });

  return (
    <div data-testid="photo-gallery">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter size={14} className="text-slate-400" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-50 border-transparent rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-sage-500"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          <option value="BEFORE">Before</option>
          <option value="AFTER">After</option>
          <option value="PROGRESS">Progress</option>
        </select>
        <select
          value={filterBodyArea}
          onChange={(e) => setFilterBodyArea(e.target.value)}
          className="bg-slate-50 border-transparent rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-sage-500"
          aria-label="Filter by body area"
        >
          <option value="">All Areas</option>
          {bodyAreas.map((area) => (
            <option key={area} value={area}>
              {area.charAt(0).toUpperCase() + area.slice(1)}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400 ml-auto">
          {filtered.length} photo{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Image size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">No photos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((photo) => {
            const ts = TYPE_STYLES[photo.type] || TYPE_STYLES.PROGRESS;
            return (
              <div
                key={photo.id}
                className="group relative rounded-xl overflow-hidden bg-slate-100 cursor-pointer hover:shadow-soft transition-shadow"
                onClick={() => setLightboxPhoto(photo)}
                data-testid="photo-card"
              >
                <img
                  src={photo.thumbnailUrl || photo.fileUrl}
                  alt={`${photo.type} — ${photo.bodyArea}`}
                  className="w-full h-40 object-cover"
                  loading="lazy"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-medium',
                        ts.bg,
                        ts.text,
                      )}
                    >
                      {photo.type}
                    </span>
                    <span className="text-[10px] text-white/80">{photo.bodyArea}</span>
                  </div>
                  <p className="text-[10px] text-white/70 mt-0.5">
                    {new Date(photo.takenAt).toLocaleDateString()}
                  </p>
                </div>
                {onSelect && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(photo);
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-sage-600 text-white rounded-full p-1 text-xs transition-opacity"
                  >
                    <Search size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-backdrop"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-3xl w-full mx-4 animate-modal-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxPhoto.fileUrl}
              alt={`${lightboxPhoto.type} — ${lightboxPhoto.bodyArea}`}
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
            <div className="mt-3 text-white">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    TYPE_STYLES[lightboxPhoto.type]?.bg,
                    TYPE_STYLES[lightboxPhoto.type]?.text,
                  )}
                >
                  {lightboxPhoto.type}
                </span>
                <span className="text-sm text-white/80">
                  {lightboxPhoto.bodyArea.charAt(0).toUpperCase() + lightboxPhoto.bodyArea.slice(1)}
                </span>
                <span className="text-xs text-white/60 ml-auto">
                  {new Date(lightboxPhoto.takenAt).toLocaleDateString()}
                </span>
              </div>
              {lightboxPhoto.notes && (
                <p className="text-sm text-white/70">{lightboxPhoto.notes}</p>
              )}
              {lightboxPhoto.booking?.service?.name && (
                <p className="text-xs text-white/50 mt-1">
                  Booking: {lightboxPhoto.booking.service.name}
                </p>
              )}
              {lightboxPhoto.takenBy?.name && (
                <p className="text-xs text-white/50">By: {lightboxPhoto.takenBy.name}</p>
              )}
            </div>
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(lightboxPhoto.id);
                  setLightboxPhoto(null);
                }}
                className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                Delete photo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
