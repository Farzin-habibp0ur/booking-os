'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileEdit, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

export function PendingDraftsCard() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const response = await api.get<unknown[]>('/outbound?status=DRAFT&take=100');
        setCount(Array.isArray(response) ? response.length : 0);
      } catch {
        setCount(0);
      } finally {
        setLoading(false);
      }
    };
    fetchDrafts();
  }, []);

  if (loading) {
    return (
      <div
        data-testid="pending-drafts-card"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft p-6 animate-pulse"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" />
        </div>
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-3" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-40" />
      </div>
    );
  }

  return (
    <div
      data-testid="pending-drafts-card"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <FileEdit size={20} className="text-lavender-500" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending AI Drafts</p>
      </div>

      <p className="font-serif text-3xl font-bold text-slate-900 dark:text-white mb-3">{count}</p>

      {count > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">drafts waiting for review</p>
          <Link
            href="/inbox"
            className="text-sm font-medium text-lavender-600 dark:text-lavender-400 hover:underline"
          >
            Review in Inbox →
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
          <span>All caught up! No drafts pending.</span>
        </div>
      )}
    </div>
  );
}
