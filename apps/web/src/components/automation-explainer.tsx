'use client';

import { useState } from 'react';
import { Zap, Bot, ChevronDown, ChevronUp, X } from 'lucide-react';

const STORAGE_KEY = 'bookingos:automation-explainer-dismissed';

export function AutomationExplainer() {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true',
  );
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="bg-lavender-50 border border-lavender-100 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <Zap size={18} className="text-sage-600" />
            <Bot size={18} className="text-lavender-600" />
          </div>
          <span className="text-sm font-medium text-slate-800">
            Two systems work together to automate your clinic
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="bg-white rounded-xl p-3">
            <Zap size={14} className="text-sage-600 mb-1" />
            <p className="font-medium text-slate-800">Playbooks & Rules</p>
            <p>
              React to events (new booking, cancellation) with automatic messages, tags, and
              assignments.
            </p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <Bot size={14} className="text-lavender-600 mb-1" />
            <p className="font-medium text-slate-800">AI Agents</p>
            <p>
              Proactively scan your data for opportunities (inactive customers, duplicate records,
              open quotes).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
