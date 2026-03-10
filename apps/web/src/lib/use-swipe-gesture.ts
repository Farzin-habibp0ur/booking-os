import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  onSwiping?: (deltaX: number) => void;
}

export function useSwipeGesture(options: SwipeOptions): SwipeHandlers {
  const { onSwipeLeft, onSwipeRight, threshold = 80, onSwiping } = options;

  const startX = useRef(0);
  const startY = useRef(0);
  const deltaX = useRef(0);
  const isTracking = useRef(false);
  const isVertical = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    deltaX.current = 0;
    isTracking.current = true;
    isVertical.current = false;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTracking.current || isVertical.current) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;

      // If vertical movement dominates, abort swipe tracking
      if (Math.abs(dy) > Math.abs(dx)) {
        isVertical.current = true;
        deltaX.current = 0;
        onSwiping?.(0);
        return;
      }

      deltaX.current = dx;
      onSwiping?.(dx);
    },
    [onSwiping],
  );

  const onTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      if (!isTracking.current || isVertical.current) {
        isTracking.current = false;
        return;
      }

      const dx = deltaX.current;

      if (Math.abs(dx) >= threshold) {
        if (dx < 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }

      // Reset
      deltaX.current = 0;
      isTracking.current = false;
      onSwiping?.(0);
    },
    [threshold, onSwipeLeft, onSwipeRight, onSwiping],
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
