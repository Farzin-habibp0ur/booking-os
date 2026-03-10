'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  X,
  Search,
  BookOpen,
  Keyboard,
  Compass,
  Mail,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { useDemoTour } from '@/components/demo-tour';
import { cn } from '@/lib/cn';

const SHORTCUT_CATEGORIES = [
  {
    label: 'General',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Search' },
      { keys: ['N'], description: 'New booking' },
      { keys: ['/'], description: 'Focus search input' },
      { keys: ['?'], description: 'Help' },
      { keys: ['⌘', '/'], description: 'Keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close modal/panel' },
    ],
  },
  {
    label: 'Navigation',
    shortcuts: [
      { keys: ['G', 'then', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'then', 'B'], description: 'Go to Bookings' },
      { keys: ['G', 'then', 'C'], description: 'Go to Customers' },
      { keys: ['G', 'then', 'I'], description: 'Go to Inbox' },
      { keys: ['G', 'then', 'S'], description: 'Go to Services' },
      { keys: ['G', 'then', 'A'], description: 'Go to Automations' },
    ],
  },
  {
    label: 'Lists',
    shortcuts: [
      { keys: ['J'], description: 'Move down in list' },
      { keys: ['K'], description: 'Move up in list' },
      { keys: ['Enter'], description: 'Open selected item' },
    ],
  },
];

function KeyboardShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        data-testid="shortcuts-backdrop"
      />
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-soft w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard Shortcuts"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Close shortcuts"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-5">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.label}>
              <h3 className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                {category.label}
              </h3>
              <div className="space-y-1.5">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) =>
                        key === 'then' ? (
                          <span key={i} className="text-xs text-slate-400">
                            then
                          </span>
                        ) : (
                          <kbd
                            key={i}
                            className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            {key}
                          </kbd>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HelpButton() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { startTour } = useDemoTour();

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => !prev);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const openShortcuts = useCallback(() => {
    setPanelOpen(false);
    setShortcutsOpen(true);
  }, []);

  // Close panel on click outside
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        closePanel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen, closePanel]);

  // Keyboard shortcuts: ? for help, Cmd+/ for shortcuts, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape closes panel
      if (e.key === 'Escape' && panelOpen) {
        e.preventDefault();
        closePanel();
        return;
      }

      // Don't trigger shortcuts when typing in an input
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Cmd+/ or Ctrl+/ opens shortcuts modal
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      // ? key toggles help panel (only when not in input)
      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        togglePanel();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [panelOpen, closePanel, togglePanel]);

  const quickLinks = [
    {
      label: 'Getting Started Guide',
      icon: BookOpen,
      href: '/help',
      external: false,
    },
    {
      label: 'Keyboard Shortcuts',
      icon: Keyboard,
      action: openShortcuts,
    },
    {
      label: 'Start Demo Tour',
      icon: Compass,
      action: () => {
        closePanel();
        startTour();
      },
    },
    {
      label: 'Contact Support',
      icon: Mail,
      href: 'mailto:support@bookingos.com',
      external: true,
    },
    {
      label: 'Feature Requests',
      icon: MessageSquare,
      href: 'mailto:feedback@bookingos.com',
      external: true,
    },
  ];

  return (
    <>
      {/* Floating help button */}
      <button
        ref={buttonRef}
        onClick={togglePanel}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-sage-600 text-white shadow-lg',
          'flex items-center justify-center transition-transform hover:scale-110 btn-press',
          'md:bottom-6',
          'bottom-20',
        )}
        aria-label="Help & Support"
        data-testid="help-button"
      >
        <LifeBuoy size={22} />
      </button>

      {/* Help panel */}
      {panelOpen && (
        <div
          ref={panelRef}
          className={cn(
            'fixed z-40 bg-white dark:bg-slate-900 rounded-2xl shadow-soft',
            'w-80 max-h-[480px] overflow-hidden',
            'md:bottom-20 md:right-6',
            'bottom-34 right-6',
            'animate-fade-in',
          )}
          role="dialog"
          aria-label="Help & Support"
          data-testid="help-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Help & Support
            </h2>
            <button
              onClick={closePanel}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Close help panel"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="px-5 py-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sage-500 rounded-xl transition-colors"
                data-testid="help-search-input"
              />
            </div>
          </div>

          {/* Quick links */}
          <div className="px-3 pb-4">
            <p className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Quick Links
            </p>
            <div className="space-y-0.5">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                if (link.action) {
                  return (
                    <button
                      key={link.label}
                      onClick={link.action}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      data-testid={`help-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon size={16} className="text-slate-400" />
                      <span className="flex-1 text-left">{link.label}</span>
                      <ChevronRight size={14} className="text-slate-300" />
                    </button>
                  );
                }
                if (link.external) {
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      data-testid={`help-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon size={16} className="text-slate-400" />
                      <span className="flex-1 text-left">{link.label}</span>
                      <ChevronRight size={14} className="text-slate-300" />
                    </a>
                  );
                }
                return (
                  <Link
                    key={link.label}
                    href={link.href!}
                    onClick={closePanel}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    data-testid={`help-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon size={16} className="text-slate-400" />
                    <span className="flex-1 text-left">{link.label}</span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-400 text-center">
              Press{' '}
              <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">
                ?
              </kbd>{' '}
              to toggle help
            </p>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts modal */}
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
