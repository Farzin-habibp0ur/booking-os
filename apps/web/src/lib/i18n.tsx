'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import en from '../locales/en.json';
import es from '../locales/es.json';

type TranslationDict = Record<string, any>;

const LOCALES: Record<string, TranslationDict> = { en, es };

export const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
];

interface I18nContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

function getNestedValue(obj: any, path: string): string | undefined {
  const result = path.split('.').reduce((acc, part) => acc?.[part], obj);
  return typeof result === 'string' ? result : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('locale') || 'en';
    }
    return 'en';
  });
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // Sync locale from user preference on load
  useEffect(() => {
    if (user) {
      const userLocale = user.locale || user.business?.defaultLocale || 'en';
      const stored = localStorage.getItem('locale');
      if (!stored) {
        setLocaleState(userLocale);
      }
    }
  }, [user]);

  // Fetch DB overrides when locale changes
  useEffect(() => {
    if (user?.businessId) {
      api.get<Record<string, string>>(`/translations?locale=${locale}`)
        .then(setOverrides)
        .catch(() => setOverrides({}));
    }
  }, [locale, user?.businessId]);

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);

    // Persist to staff record
    if (user?.id) {
      api.patch(`/staff/${user.id}`, { locale: newLocale }).catch(() => {});
    }
  }, [user?.id]);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    // Priority: DB override → current locale JSON → English JSON → key
    let value = overrides[key]
      || getNestedValue(LOCALES[locale], key)
      || getNestedValue(LOCALES['en'], key)
      || key;

    // Variable interpolation: {{variable}}
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }

    return value;
  }, [locale, overrides]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
