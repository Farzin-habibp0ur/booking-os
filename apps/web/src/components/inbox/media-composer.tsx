'use client';

import { useState, useRef, useCallback } from 'react';
import { Paperclip, X, Image, FileText, Mic, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';

interface MediaComposerProps {
  conversationId: string;
  onUploadComplete: () => void;
}

const ACCEPTED_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'audio/mpeg': ['.mp3'],
  'audio/ogg': ['.ogg'],
  'audio/wav': ['.wav'],
  'audio/webm': ['.webm'],
};

const ACCEPT_STRING = Object.keys(ACCEPTED_TYPES).join(',');

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

export function MediaComposer({ conversationId, onUploadComplete }: MediaComposerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const upload = async () => {
    if (!selectedFile) return;
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

  const FileIcon = selectedFile ? getFileIcon(selectedFile.type) : Paperclip;

  return (
    <div data-testid="media-composer">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_STRING}
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
              ? 'text-sage-600 bg-sage-50'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
          )}
          title="Attach file"
          data-testid="media-attach-button"
        >
          <Paperclip size={18} />
        </button>
      ) : (
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
            disabled={uploading}
            className="bg-sage-600 text-white px-2 py-1 rounded text-xs hover:bg-sage-700 disabled:opacity-50 flex items-center gap-1"
            data-testid="media-upload-button"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}
    </div>
  );
}
