'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TOUR_STEPS, TourStep } from './tour-steps';

type TourState = 'idle' | 'running' | 'paused' | 'complete';

interface DemoTourContextValue {
  state: TourState;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: TourStep | null;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  pauseTour: () => void;
}

const STORAGE_KEY = 'demo-tour-state';

interface PersistedState {
  stepIndex: number;
  state: TourState;
}

function loadState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state: PersistedState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Silently handle
  }
}

function clearState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently handle
  }
}

const DemoTourContext = createContext<DemoTourContextValue>({
  state: 'idle',
  currentStepIndex: 0,
  totalSteps: TOUR_STEPS.length,
  currentStep: null,
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  pauseTour: () => {},
});

export function useDemoTour() {
  return useContext(DemoTourContext);
}

export function DemoTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tourState, setTourState] = useState<TourState>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  // Restore state from localStorage on mount
  useEffect(() => {
    const persisted = loadState();
    if (persisted && persisted.state === 'running') {
      setStepIndex(persisted.stepIndex);
      setTourState('running');
    }
  }, []);

  // Auto-start tour from URL param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === 'true' && tourState === 'idle') {
      setStepIndex(0);
      setTourState('running');
      saveState({ stepIndex: 0, state: 'running' });
    }
  }, []); // Run once on mount only

  // Handle cross-page navigation: when pathname changes to match navigatingTo
  useEffect(() => {
    if (navigatingTo && pathname === navigatingTo) {
      setNavigatingTo(null);
    }
  }, [pathname, navigatingTo]);

  const currentStep = tourState === 'running' ? TOUR_STEPS[stepIndex] ?? null : null;

  // Navigate to the correct page for the current step
  useEffect(() => {
    if (tourState !== 'running' || !currentStep) return;
    if (pathname !== currentStep.page) {
      setNavigatingTo(currentStep.page);
      router.push(currentStep.page);
    }
  }, [tourState, stepIndex, currentStep, pathname, router]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setTourState('running');
    saveState({ stepIndex: 0, state: 'running' });
  }, []);

  const nextStep = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      const next = stepIndex + 1;
      setStepIndex(next);
      saveState({ stepIndex: next, state: 'running' });
    } else {
      setTourState('complete');
      clearState();
    }
  }, [stepIndex]);

  const prevStep = useCallback(() => {
    if (stepIndex > 0) {
      const prev = stepIndex - 1;
      setStepIndex(prev);
      saveState({ stepIndex: prev, state: 'running' });
    }
  }, [stepIndex]);

  const skipTour = useCallback(() => {
    setTourState('idle');
    clearState();
  }, []);

  const pauseTour = useCallback(() => {
    setTourState('paused');
    saveState({ stepIndex, state: 'paused' });
  }, [stepIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (tourState !== 'running') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        skipTour();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tourState, nextStep, prevStep, skipTour]);

  return (
    <DemoTourContext.Provider
      value={{
        state: tourState,
        currentStepIndex: stepIndex,
        totalSteps: TOUR_STEPS.length,
        currentStep,
        startTour,
        nextStep,
        prevStep,
        skipTour,
        pauseTour,
      }}
    >
      {children}
    </DemoTourContext.Provider>
  );
}
