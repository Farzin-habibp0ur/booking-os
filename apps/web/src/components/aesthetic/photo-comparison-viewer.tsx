'use client';

import { useState, useRef, useCallback } from 'react';
import { ArrowLeftRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ELEVATION } from '@/lib/design-tokens';

interface ComparisonPhoto {
  id: string;
  type: string;
  bodyArea: string;
  fileUrl: string;
  notes?: string;
  takenAt: string;
  booking?: { id: string; startTime: string; service?: { name: string } } | null;
}

interface PhotoComparison {
  id: string;
  bodyArea: string;
  notes?: string;
  createdAt: string;
  beforePhoto: ComparisonPhoto;
  afterPhoto: ComparisonPhoto;
}

interface PhotoComparisonViewerProps {
  comparisons: PhotoComparison[];
}

function ComparisonSlider({ comparison }: { comparison: PhotoComparison }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const updateSlider = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateSlider(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    updateSlider(e.clientX);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchMove = (e: React.TouchEvent) => {
    updateSlider(e.touches[0].clientX);
  };

  return (
    <div className={cn(ELEVATION.card, 'bg-white overflow-hidden')} data-testid="comparison-card">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <ArrowLeftRight size={14} className="text-lavender-600" />
          <span className="text-sm font-medium text-slate-900">
            {comparison.bodyArea.charAt(0).toUpperCase() + comparison.bodyArea.slice(1)}
          </span>
        </div>
        {comparison.notes && <p className="text-xs text-slate-500 mt-1">{comparison.notes}</p>}
      </div>

      {/* Slider */}
      <div
        ref={containerRef}
        className="relative w-full h-64 sm:h-80 select-none overflow-hidden cursor-col-resize"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        data-testid="comparison-slider"
      >
        {/* After photo (full background) */}
        <img
          src={comparison.afterPhoto.fileUrl}
          alt="After"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Before photo (clipped) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
          <img
            src={comparison.beforePhoto.fileUrl}
            alt="Before"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ width: containerRef.current?.offsetWidth || '100%' }}
          />
        </div>

        {/* Slider handle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-soft flex items-center justify-center">
            <ArrowLeftRight size={14} className="text-slate-600" />
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            Before
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className="text-[10px] bg-sage-50 text-sage-700 px-2 py-0.5 rounded-full font-medium">
            After
          </span>
        </div>
      </div>

      {/* Date info */}
      <div className="p-3 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Calendar size={12} />
          <span>Before: {new Date(comparison.beforePhoto.takenAt).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar size={12} />
          <span>After: {new Date(comparison.afterPhoto.takenAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

export function PhotoComparisonViewer({ comparisons }: PhotoComparisonViewerProps) {
  if (comparisons.length === 0) {
    return (
      <div className="text-center py-12">
        <ArrowLeftRight size={32} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">No comparisons yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Create a comparison by selecting a before and after photo
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="comparison-viewer">
      {comparisons.map((c) => (
        <ComparisonSlider key={c.id} comparison={c} />
      ))}
    </div>
  );
}
