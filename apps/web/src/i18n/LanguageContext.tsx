"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { translations, LanguageCode } from './translations';

const LOCALES: Record<LanguageCode, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

interface LanguageContextType {
  language: LanguageCode;
  locale: string;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// The saved language lives in localStorage; expose it as an external store so SSR renders English
// and the client picks up the saved choice during hydration without a setState-in-effect cascade.
const STORAGE_KEY = 'panchayat_language';
const listeners = new Set<() => void>();
let current: LanguageCode | null = null;
const readSaved = (): LanguageCode => {
  if (current) return current;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    current = saved && saved in translations ? (saved as LanguageCode) : 'en';
  } catch {
    current = 'en';
  }
  return current;
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const noopSubscribe = () => () => {};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const language = useSyncExternalStore(subscribe, readSaved, () => 'en' as LanguageCode);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    listeners.forEach(l => l());
  }, []);

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    const dict = translations[language] || translations.en;
    let text: string = dict[key as keyof typeof dict] || translations.en[key as keyof typeof translations.en] || key;

    if (params) {
      Object.keys(params).forEach(p => {
        text = text.replace(`{${p}}`, params[p]);
      });
    }

    return text;
  }, [language]);

  const value = useMemo(
    () => ({ language, locale: LOCALES[language], setLanguage, t }),
    [language, setLanguage, t]
  );

  // Hold the first paint until the saved language is known, so Hindi/Marathi users never see an English flash.
  return (
    <LanguageContext.Provider value={value}>
      <div className={`h-full ${mounted ? 'opacity-100 transition-opacity duration-300' : 'opacity-0'}`}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
