'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { Plus, Pin, LayoutDashboard, Share2, Trash2, MoreHorizontal } from 'lucide-react';
import { SaveViewModal } from './save-view-modal';

interface ViewPickerProps {
  page: string;
  currentFilters: Record<string, unknown>;
  activeViewId: string | null;
  onApplyView: (filters: Record<string, unknown>, viewId: string) => void;
  onClearView: () => void;
}

export function ViewPicker({
  page,
  currentFilters,
  activeViewId,
  onApplyView,
  onClearView,
}: ViewPickerProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [views, setViews] = useState<any[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const loadViews = useCallback(async () => {
    try {
      const data = await api.get<any[]>(`/saved-views?page=${page}`);
      setViews(data);
    } catch {
      // Silently handle
    }
  }, [page]);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  // Check if current filters differ from active view
  const hasUnsavedChanges = (() => {
    if (!activeViewId) return false;
    const activeView = views.find((v) => v.id === activeViewId);
    if (!activeView) return false;
    return JSON.stringify(currentFilters) !== JSON.stringify(activeView.filters);
  })();

  const handlePinToggle = async (viewId: string, isPinned: boolean) => {
    try {
      await api.patch(`/saved-views/${viewId}`, { isPinned: !isPinned });
      loadViews();
    } catch {
      // Silently handle
    }
    setMenuOpenId(null);
  };

  const handleDashboardToggle = async (viewId: string, isDashboard: boolean) => {
    try {
      await api.patch(`/saved-views/${viewId}`, { isDashboard: !isDashboard });
      loadViews();
    } catch {
      // Silently handle
    }
    setMenuOpenId(null);
  };

  const handleShare = async (viewId: string) => {
    try {
      await api.patch(`/saved-views/${viewId}/share`, { isShared: true });
      loadViews();
    } catch {
      // Silently handle
    }
    setMenuOpenId(null);
  };

  const handleDelete = async (viewId: string) => {
    try {
      await api.del(`/saved-views/${viewId}`);
      if (activeViewId === viewId) onClearView();
      loadViews();
    } catch {
      // Silently handle
    }
    setMenuOpenId(null);
  };

  const handleViewSaved = (view: any) => {
    setViews((prev) => [...prev, view]);
    onApplyView(view.filters, view.id);
  };

  if (views.length === 0 && !showSaveModal) {
    return (
      <div data-testid="view-picker" className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-sage-600 transition-colors"
        >
          <Plus size={12} />
          {t('saved_views.save_current')}
        </button>
        {showSaveModal && (
          <SaveViewModal
            page={page}
            filters={currentFilters}
            onClose={() => setShowSaveModal(false)}
            onSaved={handleViewSaved}
          />
        )}
      </div>
    );
  }

  return (
    <div data-testid="view-picker" className="flex items-center gap-1.5 mb-3 flex-wrap">
      {/* "All" pill to clear active view */}
      <button
        onClick={onClearView}
        className={cn(
          'text-xs px-2.5 py-1 rounded-xl transition-colors',
          !activeViewId
            ? 'bg-sage-100 text-sage-700 font-medium'
            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100',
        )}
      >
        {t('common.all')}
      </button>

      {/* Saved view pills */}
      {views.map((view) => (
        <div key={view.id} className="relative">
          <button
            onClick={() => onApplyView(view.filters, view.id)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1',
              activeViewId === view.id
                ? 'bg-sage-100 text-sage-700 font-medium'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100',
            )}
          >
            {view.name}
            {activeViewId === view.id && hasUnsavedChanges && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
            )}
            {view.isShared && (
              <Share2 size={10} className="text-slate-400" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenId(menuOpenId === view.id ? null : view.id);
            }}
            className="absolute -right-1 -top-1 w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100"
            style={{ opacity: menuOpenId === view.id ? 1 : undefined }}
          >
            <MoreHorizontal size={10} />
          </button>

          {/* Dropdown menu */}
          {menuOpenId === view.id && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-900 rounded-xl shadow-soft border border-slate-100 dark:border-slate-800 py-1 z-20 min-w-[140px]">
              <button
                onClick={() => handlePinToggle(view.id, view.isPinned)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 w-full"
              >
                <Pin size={12} />
                {view.isPinned ? t('saved_views.unpin') : t('saved_views.pin')}
              </button>
              <button
                onClick={() => handleDashboardToggle(view.id, view.isDashboard)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 w-full"
              >
                <LayoutDashboard size={12} />
                {view.isDashboard ? t('saved_views.remove_dashboard') : t('saved_views.add_dashboard')}
              </button>
              {isAdmin && !view.isShared && (
                <button
                  onClick={() => handleShare(view.id)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 w-full"
                >
                  <Share2 size={12} />
                  {t('saved_views.share')}
                </button>
              )}
              <button
                onClick={() => handleDelete(view.id)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
              >
                <Trash2 size={12} />
                {t('saved_views.delete')}
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Save current button */}
      <button
        onClick={() => setShowSaveModal(true)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-sage-600 transition-colors"
      >
        <Plus size={12} />
        {t('saved_views.save_current')}
      </button>

      {showSaveModal && (
        <SaveViewModal
          page={page}
          filters={currentFilters}
          onClose={() => setShowSaveModal(false)}
          onSaved={handleViewSaved}
        />
      )}
    </div>
  );
}
