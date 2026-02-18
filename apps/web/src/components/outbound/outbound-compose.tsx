'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';

interface OutboundComposeProps {
  customerId?: string;
  customerName?: string;
  onSend: (data: { customerId: string; content: string }) => void;
  onClose: () => void;
  loading?: boolean;
}

export function OutboundCompose({
  customerId,
  customerName,
  onSend,
  onClose,
  loading,
}: OutboundComposeProps) {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (!customerId || !content.trim()) return;
    onSend({ customerId, content: content.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      data-testid="outbound-compose"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            New Message {customerName && `to ${customerName}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            data-testid="close-compose"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your message..."
            rows={4}
            className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 rounded-xl px-3 py-2 text-sm resize-none"
            data-testid="compose-textarea"
          />
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-sage-600 text-white hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="send-draft"
          >
            <Send size={14} /> Send Draft
          </button>
        </div>
      </div>
    </div>
  );
}
