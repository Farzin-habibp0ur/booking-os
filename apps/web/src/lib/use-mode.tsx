'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from './auth';
import { usePack } from './vertical-pack';
import { api } from './api';
import {
  AppMode,
  ModeDefinition,
  getAvailableModes,
  getDefaultMode,
  getModeLabel,
  getModeByKey,
} from './mode-config';

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  availableModes: ModeDefinition[];
  modeLabel: string;
  landingPath: string;
  modeDef: ModeDefinition | undefined;
}

const ModeContext = createContext<ModeContextType>({
  mode: 'admin',
  setMode: () => {},
  availableModes: [],
  modeLabel: 'Admin',
  landingPath: '/dashboard',
  modeDef: undefined,
});

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pack = usePack();

  const role = user?.role || 'AGENT';
  const availableModes = getAvailableModes(role);

  // Derive initial mode: preferences > localStorage > role default
  const getInitialMode = (): AppMode => {
    if (user?.preferences?.mode) {
      const pref = user.preferences.mode as AppMode;
      if (availableModes.some((m) => m.key === pref)) return pref;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('app-mode');
      if (stored && availableModes.some((m) => m.key === stored)) return stored as AppMode;
    }
    return getDefaultMode(role);
  };

  const [mode, setModeState] = useState<AppMode>(getInitialMode);

  // Re-derive mode if user changes (e.g. login/logout)
  useEffect(() => {
    const initial = getInitialMode();
    setModeState(initial);
  }, [user?.id, user?.role]);

  // Debounced API call ref
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    // Instant localStorage update
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-mode', newMode);
    }
    // Debounced API persistence
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      api.patch('/staff/me/preferences', { mode: newMode }).catch(() => {});
    }, 300);
  }, []);

  const modeDef = getModeByKey(mode);
  const modeLabel = getModeLabel(mode, pack.name);
  const landingPath = modeDef?.defaultLandingPath || '/dashboard';

  return (
    <ModeContext.Provider
      value={{ mode, setMode, availableModes, modeLabel, landingPath, modeDef }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  return useContext(ModeContext);
}
