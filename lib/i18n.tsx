/**
 * Prevayl Carrier App — i18n (Internationalization)
 * Lightweight translation context — no external library needed.
 * 
 * Usage:
 *   const { t, language, setLanguage } = useTranslation();
 *   t('nav.dashboard')  // returns "Dashboard" or translated equivalent
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'en' | 'es' | 'ru' | 'ro' | 'pl' | 'uk' | 'pt';

export const LANGUAGES: { code: Language; label: string; flag: string; native: string }[] = [
  { code: 'en', label: 'English',    flag: '🇺🇸', native: 'English' },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸', native: 'Español' },
  { code: 'ru', label: 'Russian',    flag: '🇷🇺', native: 'Русский' },
  { code: 'ro', label: 'Romanian',   flag: '🇷🇴', native: 'Română' },
  { code: 'pl', label: 'Polish',     flag: '🇵🇱', native: 'Polski' },
  { code: 'uk', label: 'Ukrainian',  flag: '🇺🇦', native: 'Українська' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷', native: 'Português' },
];

// Locale imports — static for bundle efficiency
const locales: Record<Language, any> = {
  en: require('../locales/en.json'),
  es: require('../locales/es.json'),
  ru: require('../locales/ru.json'),
  ro: require('../locales/ro.json'),
  pl: require('../locales/pl.json'),
  uk: require('../locales/uk.json'),
  pt: require('../locales/pt.json'),
};

const STORAGE_KEY = 'prevayl_carrier_language';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  languageInfo: typeof LANGUAGES[0];
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  languageInfo: LANGUAGES[0],
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved && saved in locales) {
        setLanguageState(saved as Language);
      }
    });
  }, []);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang);
  }

  function t(key: string, fallback?: string): string {
    const keys = key.split('.');
    
    // Try current language first
    let result: any = locales[language];
    for (const k of keys) {
      result = result?.[k];
      if (result === undefined) break;
    }
    
    // Fall back to English
    if (!result || typeof result !== 'string') {
      let en: any = locales['en'];
      for (const k of keys) {
        en = en?.[k];
        if (en === undefined) break;
      }
      result = typeof en === 'string' ? en : fallback || key;
    }
    
    return typeof result === 'string' ? result : fallback || key;
  }

  const languageInfo = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, languageInfo }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useTranslation = () => useContext(I18nContext);
