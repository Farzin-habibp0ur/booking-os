'use client';

import { useState } from 'react';
import { X, MessageSquare, Mail, Smartphone } from 'lucide-react';

interface PlaybookPreviewModalProps {
  playbook: {
    name: string;
    description: string;
    playbook: string;
  };
  sampleMessage: string;
  businessName: string;
  onConfirm: (messageOverride?: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'email', label: 'Email', icon: Mail },
] as const;

function highlightVariables(template: string) {
  return template.split(/(\{[^}]+\})/).map((part, i) =>
    part.startsWith('{') ? (
      <span key={i} className="bg-lavender-100 text-lavender-700 px-1 rounded text-xs font-mono">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function PlaybookPreviewModal({
  playbook,
  sampleMessage,
  businessName,
  onConfirm,
  onClose,
}: PlaybookPreviewModalProps) {
  const [channel, setChannel] = useState<string>('whatsapp');
  const [message, setMessage] = useState(sampleMessage);
  const [confirming, setConfirming] = useState(false);

  const previewMessage = message
    .replace(/\{name\}/g, 'Sarah')
    .replace(/\{businessName\}/g, businessName)
    .replace(/\{service\}/g, 'Hydra Facial')
    .replace(/\{time\}/g, '2:00 PM')
    .replace(/\{bookingLink\}/g, 'book.example.com');

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const override = message !== sampleMessage ? { [channel]: message } : undefined;
      await onConfirm(override);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold text-slate-900">Preview: {playbook.name}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">{playbook.description}</p>

          {/* Channel selector */}
          <div className="flex gap-1">
            {CHANNELS.map((ch) => (
              <button
                key={ch.key}
                onClick={() => setChannel(ch.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  channel === ch.key
                    ? 'bg-sage-100 text-sage-700 font-medium'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <ch.icon size={12} />
                {ch.label}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Preview</label>
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700">
              {previewMessage}
            </div>
          </div>

          {/* Template editor */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Message template
            </label>
            <div className="bg-white rounded-xl border border-slate-200 p-3 text-sm text-slate-700 mb-1">
              {highlightVariables(message)}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border-transparent rounded-xl px-3 py-2 text-sm focus:bg-white focus:ring-2 focus:ring-sage-500"
              data-testid="message-editor"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-4 py-2 text-sm bg-sage-600 text-white rounded-xl hover:bg-sage-700 transition-colors disabled:opacity-50"
            data-testid="confirm-activate-btn"
          >
            {confirming ? 'Activating...' : 'Activate with this message'}
          </button>
        </div>
      </div>
    </div>
  );
}
