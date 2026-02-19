'use client';

import { useState } from 'react';
import { Download, FileText, Play, Pause, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';

interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  thumbnailKey?: string;
}

interface MediaMessageProps {
  attachments: Attachment[];
  direction: 'INBOUND' | 'OUTBOUND';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageAttachment({ attachment, direction }: { attachment: Attachment; direction: string }) {
  const [showLightbox, setShowLightbox] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const src = `${apiUrl}/attachments/${attachment.id}/download`;

  return (
    <>
      <button
        onClick={() => setShowLightbox(true)}
        className="block rounded-lg overflow-hidden max-w-[240px] hover:opacity-90 transition-opacity"
        data-testid={`media-image-${attachment.id}`}
      >
        <img
          src={src}
          alt={attachment.fileName}
          className="max-w-full h-auto rounded-lg"
          loading="lazy"
        />
      </button>
      {showLightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
          data-testid="media-lightbox"
        >
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 text-white hover:text-slate-300"
          >
            <X size={24} />
          </button>
          <img
            src={src}
            alt={attachment.fileName}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </>
  );
}

function DocumentAttachment({ attachment }: { attachment: Attachment }) {
  const handleDownload = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/attachments/${attachment.id}/download`,
        { credentials: 'include' },
      );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/attachments/${attachment.id}/download`,
        '_blank',
      );
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-colors"
      data-testid={`media-document-${attachment.id}`}
    >
      <FileText size={18} className="flex-shrink-0" />
      <div className="text-left min-w-0">
        <p className="text-xs font-medium truncate">{attachment.fileName}</p>
        <p className="text-[10px] opacity-70">{formatFileSize(attachment.fileSize)}</p>
      </div>
      <Download size={14} className="flex-shrink-0 opacity-70" />
    </button>
  );
}

function AudioAttachment({ attachment }: { attachment: Attachment }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  const src = `${apiUrl}/attachments/${attachment.id}/download`;

  return (
    <div className="max-w-[240px]" data-testid={`media-audio-${attachment.id}`}>
      <audio controls preload="none" className="w-full h-8">
        <source src={src} type={attachment.fileType} />
      </audio>
      <p className="text-[10px] opacity-70 mt-0.5">{attachment.fileName}</p>
    </div>
  );
}

export function MediaMessage({ attachments, direction }: MediaMessageProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-1">
      {attachments.map((att) => {
        if (att.fileType.startsWith('image/')) {
          return <ImageAttachment key={att.id} attachment={att} direction={direction} />;
        }
        if (att.fileType.startsWith('audio/')) {
          return <AudioAttachment key={att.id} attachment={att} />;
        }
        return <DocumentAttachment key={att.id} attachment={att} />;
      })}
    </div>
  );
}
