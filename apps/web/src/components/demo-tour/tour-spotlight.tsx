'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDemoTour } from './demo-tour-provider';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TourSpotlight() {
  const { state, currentStep } = useDemoTour();
  const [rect, setRect] = useState<TargetRect | null>(null);

  const updateRect = useCallback(() => {
    if (!currentStep) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour-target="${currentStep.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const padding = currentStep.highlightPadding ?? 4;
    setRect({
      top: r.top - padding,
      left: r.left - padding,
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    });

    // Scroll the main content area to top, then scroll target into view if needed
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // After scroll-to-top, reposition if target is still off-screen
    requestAnimationFrame(() => {
      const updated = el.getBoundingClientRect();
      if (updated.top < 0 || updated.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, [currentStep]);

  // Update rect when step changes
  useEffect(() => {
    if (state !== 'running') {
      setRect(null);
      return;
    }
    // Delay slightly to allow page render after navigation
    const timer = setTimeout(updateRect, 150);
    return () => clearTimeout(timer);
  }, [state, currentStep, updateRect]);

  // Reposition on resize/scroll
  useEffect(() => {
    if (state !== 'running') return;
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [state, updateRect]);

  if (state !== 'running' || !rect) return null;

  const shadowSpread = Math.max(window.innerWidth, window.innerHeight) * 2;

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-auto"
      style={
        {
          // Click-through prevention: overlay blocks clicks outside the spotlight
        }
      }
      onClick={(e) => {
        // Prevent clicks on the backdrop
        const target = e.target as HTMLElement;
        if (target === e.currentTarget) {
          e.stopPropagation();
        }
      }}
    >
      {/* Shadow overlay with cutout */}
      <div
        className="absolute transition-all duration-300 ease-in-out rounded-2xl"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: `0 0 0 ${shadowSpread}px rgba(0, 0, 0, 0.5)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
