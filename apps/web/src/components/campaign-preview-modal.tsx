'use client';

import { X } from 'lucide-react';

interface CampaignPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  channel: string;
  businessName: string;
}

function renderPreview(content: string): string {
  return content
    .replace(/\{\{name\}\}/gi, 'Sarah')
    .replace(/\{\{service\}\}/gi, 'Botox Treatment')
    .replace(/\{\{business\}\}/gi, 'Glow Aesthetic Clinic')
    .replace(/\{\{date\}\}/gi, 'Mon Apr 14, 10:00 AM')
    .replace(/\{\{staff\}\}/gi, 'Dr. Smith');
}

export default function CampaignPreviewModal({
  isOpen,
  onClose,
  content,
  channel,
  businessName,
}: CampaignPreviewModalProps) {
  if (!isOpen) return null;

  const preview = renderPreview(content || '');
  const time = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      data-testid="preview-modal"
    >
      <div className="bg-white rounded-2xl shadow-soft w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Message Preview</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* WhatsApp Preview */}
          <div data-testid="preview-whatsapp">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
              WhatsApp
            </p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <div className="bg-[#075E54] px-4 py-3">
                <p className="text-sm font-medium text-white">{businessName}</p>
              </div>
              <div className="p-4 min-h-[200px]" style={{ backgroundColor: '#ECE5DD' }}>
                <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 shadow-sm max-w-[85%]">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
                  <p className="text-[10px] text-slate-400 text-right mt-1">{time}</p>
                </div>
              </div>
            </div>
          </div>

          {/* SMS Preview */}
          <div data-testid="preview-sms">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">SMS</p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <div className="bg-slate-100 px-4 py-3">
                <p className="text-sm font-medium text-slate-700">{businessName}</p>
              </div>
              <div className="bg-slate-50 p-4 min-h-[200px]">
                <div className="bg-slate-200 rounded-2xl rounded-bl-none px-3 py-2 max-w-[85%]">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">{time}</p>
              </div>
            </div>
          </div>

          {/* Email Preview */}
          <div data-testid="preview-email">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
              Email
            </p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              <div className="bg-white px-4 py-3 border-b border-slate-100">
                <p className="text-xs text-slate-500">
                  From: <span className="text-slate-700">{businessName}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Subject: <span className="text-slate-700">A message from {businessName}</span>
                </p>
                <p className="text-xs text-slate-400">{new Date().toLocaleDateString()}</p>
              </div>
              <div className="bg-white p-4 min-h-[200px]">
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
