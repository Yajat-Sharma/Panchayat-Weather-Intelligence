"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, LanguageCode } from './translations';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check localStorage on mount
    const saved = localStorage.getItem('panchayat_language') as LanguageCode;
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'mr')) {
      setLanguageState(saved);
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('panchayat_language', lang);
  };

  const t = (key: string, params?: Record<string, string>): string => {
    // If not mounted (SSR), return english safely without hydration mismatch
    // But since it's a client component, we prefer to return the current state
    const dict = translations[language] || translations['en'];
    let text = dict[key as keyof typeof dict] || translations['en'][key as keyof typeof translations['en']] || key;
    
    if (params) {
      Object.keys(params).forEach(p => {
        text = text.replace(`{${p}}`, params[p]);
      });
    }
    
    return text;
  };

  // Prevent hydration mismatch by not rendering translation-dependent stuff until mounted
  // However, returning children directly is usually fine if text matches server (English default)
  // We'll just return it. The user might see English flash for a ms if they selected Hindi.
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className={!mounted ? 'opacity-0' : 'opacity-100 transition-opacity duration-200'}>
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
