'use client';

import { useState, useRef, useCallback } from 'react';
import { Paperclip, X, Image, FileText, Mic, Upload, Loader2, AlertTriangle, Mail } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { CHANNEL_STYLES } from '@/lib/design-tokens';

interface MediaComposerProps {
  conversationId: string;
  onUploadComplete: () => void;
  channel?: string;
  onSwitchToEmail?: () => void;
}

// Per-channel accepted MIME types
const CHANNEL_ACCEPTED: Record<string, Record<string, string[]>> = {
  WHATSAPP: {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'audio/*': ['.mp3', '.ogg', '.wav', '.webm'],
    'video/*': ['.mp4', '.3gp'],
  },
  INSTAGRAM: {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
    'video/mp4': ['.mp4'],
    'audio/*': ['.mp3', '.ogg', '.wav', '.webm'],
  },
  FACEBOOK: {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'audio/*': ['.mp3', '.ogg', '.wav'],
    'video/*': ['.mp4'],
  },
  SMS: {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
    'video/*': ['.mp4', '.3gp'],
  },
  EMAIL: {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
    'audio/*': ['.mp3', '.ogg', '.wav', '.webm'],
    'video/*': ['.mp4'],
  },
  WEB_CHAT: {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'audio/*': ['.mp3', '.ogg', '.wav'],
    'video/*': ['.mp4'],
  },
};

// Per-channel file size limits in bytes
const CHANNEL_SIZE_LIMITS: Record<string, number> = {
  WHATSAPP: 16 * 1024 * 1024,
  INSTAGRAM: 8 * 1024 * 1024,
  FACEBOOK: 25 * 1024 * 1024,
  SMS: 5 * 1024 * 1024,
  EMAIL: 25 * 1024 * 1024,
  WEB_CHAT: 10 * 1024 * 1024,
};

function getAcceptString(channel?: string): string {
  const types = CHANNEL_ACCEPTED[channel || 'EMAIL'] || CHANNEL_ACCEPTED.EMAIL;
  return Object.keys(types).join(',');
}

function isFileTypeValid(file: File, channel?: string): boolean {
  const types = CHANNEL_ACCEPTED[channel || 'EMAIL'] || CHANNEL_ACCEPTED.EMAIL;
  const mimeKeys = Object.keys(types);
  return mimeKeys.some((mime) => {
    if (mime.endsWith('/*')) {
      return file.type.startsWith(mime.replace('/*', '/'));
    }
    return file.type === mime;
  });
}

function isFileSizeValid(file: File, channel?: string): boolean {
  const limit = CHANNEL_SIZE_LIMITS[channel || 'EMAIL'] || CHANNEL_SIZE_LIMITS.EMAIL;
  return file.size <= limit;
}

function getSizeLimitMB(channel?: string): number {
  const limit = CHANNEL_SIZE_LIMITS[channel || 'EMAIL'] || CHANNEL_SIZE_LIMITS.EMAIL;
  return Math.round(limit / (1024 * 1024));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('audio/')) return Mic;
  return FileText;
}

export function MediaComposer({ conversationId, onUploadComplete, channel, onSwitchToEmail }: MediaComposerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const channelStyle = CHANNEL_STYLES[channel || 'EMAIL'];

  const validateFile = useCallback((file: File): string | null => {
    if (!isFileTypeValid(file, channel)) {
      return `${file.name} is not supported on ${channelStyle?.label || channel}`;
    }
    if (!isFileSizeValid(file, channel)) {
      return `${file.name} exceeds ${getSizeLimitMB(channel)}MB limit for ${channelStyle?.label || channel}`;
    }
    return null;
  }, [channel, channelStyle]);

  const handleFileSelect = useCallback((file: File) => {
    const error = validateFile(file);
    setValidationError(error);
    setSelectedFile(file);
    if (file.type.startsWith('image/') && !error) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, [validateFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setValidationError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const upload = async () => {
    if (!selectedFile || validationError) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      await api.upload(`/conversations/${conversationId}/messages/media`, formData);
      clearFile();
      onUploadComplete();
    } catch (e: any) {
      toast(e?.message || 'Failed to upload file', 'error');
    }
    setUploading(false);
  };

  // Re-validate when channel changes
  const prevChannelRef = useRef(channel);
  if (prevChannelRef.current !== channel) {
    prevChannelRef.current = channel;
    if (selectedFile) {
      const error = validateFile(selectedFile);
      if (error !== validationError) setValidationError(error);
    }
  }

  const FileIcon = selectedFile ? getFileIcon(selectedFile.type) : Paperclip;

  return (
    <div data-testid="media-composer">
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptString(channel)}
        onChange={handleInputChange}
        className="hidden"
        data-testid="media-file-input"
      />

      {!selectedFile ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'p-2 rounded transition-colors',
            dragOver
              ? channelStyle ? `${channelStyle.text} ${channelStyle.bg}` : 'text-sage-600 bg-sage-50'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
          )}
          title="Attach file"
          data-testid="media-attach-button"
        >
          <Paperclip size={18} />
        </button>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2 py-1.5">
            {preview ? (
              <img src={preview} alt="Preview" className="w-8 h-8 rounded object-cover" />
            ) : (
              <FileIcon size={16} className="text-slate-500" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{selectedFile.name}</p>
              <p className="text-[10px] text-slate-400">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              onClick={clearFile}
              className="text-slate-400 hover:text-red-500"
              data-testid="media-clear"
            >
              <X size={14} />
            </button>
            <button
              onClick={upload}
              disabled={uploading || !!validationError}
              className="bg-sage-600 text-white px-2 py-1 rounded text-xs hover:bg-sage-700 disabled:opacity-50 flex items-center gap-1"
              data-testid="media-upload-button"
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? 'Sending...' : 'Send'}
            </button>
          </div>
          {/* Validation error with "Switch to Email" action */}
          {validationError && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 rounded px-2 py-1" role="alert">
              <AlertTriangle size={10} className="flex-shrink-0" />
              <span className="flex-1">{validationError}</span>
              {channel !== 'EMAIL' && onSwitchToEmail && (
                <button
                  onClick={() => {
                    onSwitchToEmail();
                    setValidationError(null);
                  }}
                  className="flex items-center gap-0.5 text-[10px] text-sky-600 hover:text-sky-700 font-medium flex-shrink-0"
                  data-testid="media-switch-email"
                >
                  <Mail size={10} />
                  Switch to Email
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
