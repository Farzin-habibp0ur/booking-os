'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDemoTour } from './demo-tour-provider';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Position {
  top: number;
  left: number;
}

export function TourTooltip() {
  const { state, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, skipTour } =
    useDemoTour();
  const [pos, setPos] = useState<Position>({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);

  const calculatePosition = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(`[data-tour-target="${currentStep.target}"]`);
    if (!el) return;

    const r = el.getBoundingClientRect();
    const tooltipWidth = 320;
    const tooltipHeight = 180;
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (currentStep.position) {
      case 'bottom':
        top = r.bottom + gap;
        left = r.left + r.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = r.top - tooltipHeight - gap;
        left = r.left + r.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = r.top + r.height / 2 - tooltipHeight / 2;
        left = r.right + gap;
        break;
      case 'left':
        top = r.top + r.height / 2 - tooltipHeight / 2;
        left = r.left - tooltipWidth - gap;
        break;
    }

    // Keep within viewport bounds
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    top = Math.max(12, Math.min(top, window.innerHeight - tooltipHeight - 12));

    setPos({ top, left });
  }, [currentStep]);

  useEffect(() => {
    if (state !== 'running' || !currentStep) {
      setVisible(false);
      return;
    }
    // Delay to sync with spotlight animation
    const timer = setTimeout(() => {
      calculatePosition();
      setVisible(true);
    }, 200);
    return () => clearTimeout(timer);
  }, [state, currentStep, calculatePosition]);

  useEffect(() => {
    if (state !== 'running') return;
    const handler = () => calculatePosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [state, calculatePosition]);

  if (state !== 'running' || !currentStep || !visible) return null;

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <div
      role="dialog"
      aria-label={currentStep.title}
      className="fixed z-[70] w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-5 transition-all duration-300 ease-out"
      style={{
        top: pos.top,
        left: pos.left,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {currentStep.title}
        </h3>
        <button
          onClick={skipTour}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0 -mt-0.5"
          aria-label="Close tour"
        >
          <X size={16} />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
        {currentStep.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {currentStepIndex + 1} of {totalSteps}
        </span>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              onClick={prevStep}
              className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              aria-label="Previous step"
            >
              <ChevronLeft size={14} />
              Back
            </button>
          )}
          <button
            onClick={isLast ? skipTour : nextStep}
            className="flex items-center gap-1 text-xs font-medium text-white bg-sage-600 hover:bg-sage-700 px-3 py-1.5 rounded-xl transition-colors"
            aria-label={isLast ? 'Finish tour' : 'Next step'}
          >
            {isLast ? 'Finish' : 'Next'}
            {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
