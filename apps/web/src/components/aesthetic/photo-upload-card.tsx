'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Camera, X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ELEVATION } from '@/lib/design-tokens';
import { useToast } from '@/lib/toast';

const PHOTO_TYPES = [
  { value: 'BEFORE', label: 'Before' },
  { value: 'AFTER', label: 'After' },
  { value: 'PROGRESS', label: 'Progress' },
];

const BODY_AREAS = [
  'face',
  'forehead',
  'eyes',
  'nose',
  'lips',
  'chin',
  'jawline',
  'neck',
  'chest',
  'abdomen',
  'arms',
  'hands',
  'legs',
  'back',
  'other',
];

interface PhotoUploadCardProps {
  customerId: string;
  bookingId?: string;
  suggestedBodyAreas?: string[];
  onUploaded?: (photo: any) => void;
}

export function PhotoUploadCard({
  customerId,
  bookingId,
  suggestedBodyAreas,
  onUploaded,
}: PhotoUploadCardProps) {
  const [type, setType] = useState<string>('BEFORE');
  const [bodyArea, setBodyArea] = useState<string>(suggestedBodyAreas?.[0] || '');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      toast('Only image files are allowed', 'error');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, [toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleUpload = async () => {
    if (!file || !bodyArea || !type) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('customerId', customerId);
      formData.append('type', type);
      formData.append('bodyArea', bodyArea);
      if (bookingId) formData.append('bookingId', bookingId);
      if (notes) formData.append('notes', notes);

      const photo = await api.upload<any>('/clinical-photos', formData);
      toast('Photo uploaded successfully');
      setFile(null);
      setPreview(null);
      setNotes('');
      onUploaded?.(photo);
    } catch (err: any) {
      toast(err?.message || 'Failed to upload photo', 'error');
    }
    setUploading(false);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn(ELEVATION.card, 'bg-white p-5')} data-testid="photo-upload-card">
      <h3 className="text-sm font-semibold text-slate-900 uppercase mb-4 flex items-center gap-2">
        <Camera size={16} className="text-lavender-600" />
        Upload Clinical Photo
      </h3>

      {/* Suggested areas banner */}
      {suggestedBodyAreas && suggestedBodyAreas.length > 0 && (
        <div className="bg-lavender-50 border border-lavender-100 rounded-xl p-3 mb-4 text-sm text-lavender-900">
          <p className="font-medium mb-1">After photos suggested</p>
          <p className="text-xs text-lavender-700">
            Before photos exist for: {suggestedBodyAreas.join(', ')}
          </p>
        </div>
      )}

      {/* Type & Body Area selectors */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Photo Type</label>
          <div className="flex gap-1">
            {PHOTO_TYPES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => setType(pt.value)}
                className={cn(
                  'flex-1 text-xs py-2 rounded-lg font-medium transition-colors',
                  type === pt.value
                    ? 'bg-sage-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Body Area</label>
          <select
            value={bodyArea}
            onChange={(e) => setBodyArea(e.target.value)}
            className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
            aria-label="Body area"
          >
            <option value="">Select area...</option>
            {BODY_AREAS.map((area) => (
              <option key={area} value={area}>
                {area.charAt(0).toUpperCase() + area.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Drop zone */}
      {!preview ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            dragOver
              ? 'border-sage-400 bg-sage-50'
              : 'border-slate-200 hover:border-sage-300 hover:bg-slate-50',
          )}
          data-testid="photo-drop-zone"
        >
          <Upload size={24} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-600">Drop an image or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">JPEG, PNG, GIF, WebP — max 5MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden mb-4">
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-64 object-contain bg-slate-100 rounded-xl"
          />
          <button
            onClick={clearFile}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Notes */}
      {preview && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes (optional)..."
          rows={2}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none mt-3 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
        />
      )}

      {/* Upload button */}
      {preview && (
        <div className="flex justify-end mt-3">
          <button
            onClick={handleUpload}
            disabled={uploading || !bodyArea}
            className="flex items-center gap-1.5 bg-sage-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-sage-700 transition-colors disabled:opacity-50 active:scale-95 btn-press"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {uploading ? 'Uploading...' : 'Upload Photo'}
          </button>
        </div>
      )}
    </div>
  );
}
