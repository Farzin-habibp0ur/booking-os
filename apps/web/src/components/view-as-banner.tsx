'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Eye, X } from 'lucide-react';

export function ViewAsBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const [remaining, setRemaining] = useState('');
  const [exiting, setExiting] = useState(false);

  const updateCountdown = useCallback(() => {
    // Session is 15 minutes. We estimate based on when we loaded
    // Ideally we'd fetch expiresAt from the active session
    const stored = sessionStorage.getItem('_view_as_started');
    if (!stored) return;

    const started = parseInt(stored, 10);
    const elapsed = Date.now() - started;
    const total = 15 * 60 * 1000;
    const left = Math.max(0, total - elapsed);

    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);

    if (left <= 0) {
      handleExit();
    }
  }, []);

  useEffect(() => {
    if (!user?.viewAs) return;

    // Set start time if not set
    if (!sessionStorage.getItem('_view_as_started')) {
      sessionStorage.setItem('_view_as_started', String(Date.now()));
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [user?.viewAs, updateCountdown]);

  const handleExit = async () => {
    if (exiting) return;
    setExiting(true);

    try {
      await api.post('/admin/view-as/end');
    } catch {
      // Continue anyway
    }

    sessionStorage.removeItem('_view_as_started');

    const returnPath = sessionStorage.getItem('_console_return_path') || '/console';
    sessionStorage.removeItem('_console_return_path');

    // Force a full page reload to pick up the new cookies
    window.location.href = returnPath;
  };

  if (!user?.viewAs) return null;

  return (
    <div
      className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm"
      data-testid="view-as-banner"
    >
      <div className="flex items-center gap-2">
        <Eye size={16} />
        <span>
          Viewing as <strong>{user.business?.name}</strong>
        </span>
        {remaining && (
          <span className="bg-amber-600 px-2 py-0.5 rounded text-xs font-mono">{remaining}</span>
        )}
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        data-testid="view-as-exit"
      >
        <X size={14} />
        Exit
      </button>
    </div>
  );
}
