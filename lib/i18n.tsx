/**
 * Prevayl Carrier App — i18n (Internationalization)
 * 10 languages including Arabic RTL support.
 *
 * Usage:
 *   const { t, language, setLanguage, isRTL } = useTranslation();
 *   t('nav.dashboard')  // returns translated string, falls back to English
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

export type Language = 'en' | 'es' | 'ar' | 'ru' | 'ro' | 'pl' | 'uk' | 'pt' | 'bg' | 'mk';

const RTL_LANGS = new Set<Language>(['ar']);

export const LANGUAGES: {
  code: Language;
  label: string;
  flag: string;
  native: string;
  rtl?: boolean;
}[] = [
  { code: 'en', label: 'English',    flag: '🇺🇸', native: 'English' },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸', native: 'Español' },
  { code: 'ar', label: 'Arabic',     flag: '🇸🇦', native: 'العربية', rtl: true },
  { code: 'ru', label: 'Russian',    flag: '🇷🇺', native: 'Русский' },
  { code: 'ro', label: 'Romanian',   flag: '🇷🇴', native: 'Română' },
  { code: 'pl', label: 'Polish',     flag: '🇵🇱', native: 'Polski' },
  { code: 'uk', label: 'Ukrainian',  flag: '🇺🇦', native: 'Українська' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷', native: 'Português' },
  { code: 'bg', label: 'Bulgarian',  flag: '🇧🇬', native: 'Български' },
  { code: 'mk', label: 'Macedonian', flag: '🇲🇰', native: 'Македонски' },
];

// Static locale imports
const locales: Record<Language, any> = {
  en: require('../locales/en.json'),
  es: require('../locales/es.json'),
  ar: require('../locales/ar.json'),
  ru: require('../locales/ru.json'),
  ro: require('../locales/ro.json'),
  pl: require('../locales/pl.json'),
  uk: require('../locales/uk.json'),
  pt: require('../locales/pt.json'),
  bg: require('../locales/bg.json'),
  mk: require('../locales/mk.json'),
};

const STORAGE_KEY = 'prevayl_carrier_language';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  languageInfo: typeof LANGUAGES[0];
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  languageInfo: LANGUAGES[0],
  isRTL: false,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved && saved in locales) {
        applyLanguage(saved as Language, false);
      }
    });
  }, []);

  function applyLanguage(lang: Language, save = true) {
    const rtl = RTL_LANGS.has(lang);

    // Apply RTL layout to React Native
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
      // Note: RN requires app restart for RTL to fully apply
      // On web carrier portal, document.dir is set via useEffect in components
    }

    setLanguageState(lang);
    if (save) {
      AsyncStorage.setItem(STORAGE_KEY, lang);
    }
  }

  function setLanguage(lang: Language) {
    applyLanguage(lang);
  }

  function t(key: string, fallback?: string): string {
    const keys = key.split('.');

    // Try current language
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

  const isRTL = RTL_LANGS.has(language);
  const languageInfo = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, languageInfo, isRTL }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useTranslation = () => useContext(I18nContext);
