'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, X } from 'lucide-react';

interface FeatureDiscoveryProps {
  id: string;
  title: string;
  description: string;
}

export function FeatureDiscovery({ id, title, description }: FeatureDiscoveryProps) {
  const [visible, setVisible] = useState(false);
  const storageKey = `feature-discovery-${id}`;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setVisible(true);
      }
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, '1');
    }
  };

  if (!visible) return null;

  return (
    <div
      className="mb-4 bg-sage-50 border border-sage-200 rounded-xl p-4 flex items-start gap-3"
      data-testid="feature-discovery"
    >
      <Lightbulb size={18} className="text-sage-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-sage-900">{title}</p>
        <p className="text-xs text-sage-700 mt-0.5">{description}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        data-testid="feature-discovery-dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
