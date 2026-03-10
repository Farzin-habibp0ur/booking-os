import { useEffect, useRef, useCallback } from 'react';

/** Check if the event target is an input-like element */
function isInputTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

type ShortcutHandler = (e: KeyboardEvent) => void;

interface ShortcutOptions {
  /** If true, the shortcut fires even when focused on an input/textarea */
  allowInInputs?: boolean;
  /** If true, calls e.preventDefault() */
  preventDefault?: boolean;
}

/**
 * Register a single keyboard shortcut.
 * Handles input detection and cleanup automatically.
 */
export function useKeyboardShortcut(
  key: string,
  handler: ShortcutHandler,
  options: ShortcutOptions & { meta?: boolean; shift?: boolean } = {},
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (options.meta && !(e.metaKey || e.ctrlKey)) return;
      if (options.shift && !e.shiftKey) return;
      if (!options.meta && (e.metaKey || e.ctrlKey)) return;
      if (e.key !== key) return;
      if (!options.allowInInputs && isInputTarget(e)) return;
      if (options.preventDefault) e.preventDefault();
      handlerRef.current(e);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [key, options.meta, options.shift, options.allowInInputs, options.preventDefault]);
}

/**
 * Register a chord shortcut (e.g., G then B).
 * First key starts the chord, second key within timeout completes it.
 */
export function useChordShortcut(
  firstKey: string,
  chords: Record<string, ShortcutHandler>,
  timeoutMs = 800,
) {
  const chordsRef = useRef(chords);
  chordsRef.current = chords;
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isInputTarget(e)) return;

      if (pendingRef.current) {
        pendingRef.current = false;
        clearTimeout(timerRef.current);
        const handler = chordsRef.current[e.key.toLowerCase()];
        if (handler) {
          e.preventDefault();
          handler(e);
        }
        return;
      }

      if (e.key.toLowerCase() === firstKey.toLowerCase()) {
        pendingRef.current = true;
        timerRef.current = setTimeout(() => {
          pendingRef.current = false;
        }, timeoutMs);
      }
    };
    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
      clearTimeout(timerRef.current);
    };
  }, [firstKey, timeoutMs]);
}

/**
 * Hook for J/K list navigation.
 * Returns the selected index and a setter.
 * Handles wrapping and keyboard events.
 */
export function useListNavigation(itemCount: number, onSelect?: (index: number) => void) {
  const indexRef = useRef(-1);
  const countRef = useRef(itemCount);
  countRef.current = itemCount;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  const setIndex = useCallback((idx: number) => {
    indexRef.current = idx;
    selectRef.current?.(idx);
  }, []);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (isInputTarget(e)) return;
      if (e.metaKey || e.ctrlKey) return;
      const count = countRef.current;
      if (count === 0) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = indexRef.current < count - 1 ? indexRef.current + 1 : 0;
        setIndex(next);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = indexRef.current > 0 ? indexRef.current - 1 : count - 1;
        setIndex(next);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [setIndex]);

  return { setIndex, getIndex: () => indexRef.current };
}
