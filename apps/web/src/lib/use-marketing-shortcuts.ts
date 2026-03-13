'use client';

import { useKeyboardShortcut, useListNavigation } from './use-keyboard-shortcut';

interface ActionTriageShortcutOptions {
  /** Approve the currently selected card */
  onApprove: () => void;
  /** Dismiss the currently selected card */
  onDismiss: () => void;
  /** Snooze the currently selected card */
  onSnooze: () => void;
  /** Close expanded view */
  onEscape: () => void;
}

/**
 * Keyboard shortcuts for the Action Triage page (/ai/actions).
 * - 'a': approve selected
 * - 'd': dismiss selected
 * - 's': snooze selected
 * - Escape: close expanded
 */
export function useActionTriageShortcuts(options: ActionTriageShortcutOptions) {
  useKeyboardShortcut('a', () => options.onApprove());
  useKeyboardShortcut('d', () => options.onDismiss());
  useKeyboardShortcut('s', () => options.onSnooze());
  useKeyboardShortcut('Escape', () => options.onEscape(), { allowInInputs: true });
}

interface QueueShortcutOptions {
  /** Total number of items in the queue */
  itemCount: number;
  /** Called when selected index changes */
  onSelect: (index: number) => void;
  /** Expand the currently selected draft */
  onExpand: () => void;
  /** Close expanded view */
  onEscape: () => void;
}

/**
 * Keyboard shortcuts for the Content Queue page (/marketing/queue).
 * - j/k or Arrow keys: navigate between drafts (useListNavigation)
 * - Enter: expand selected draft
 * - Escape: close expanded view
 */
export function useQueueShortcuts(options: QueueShortcutOptions) {
  const nav = useListNavigation(options.itemCount, options.onSelect);
  useKeyboardShortcut('Enter', () => options.onExpand());
  useKeyboardShortcut('Escape', () => options.onEscape(), { allowInInputs: true });
  return nav;
}
