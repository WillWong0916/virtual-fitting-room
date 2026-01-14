import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import enTranslations from '../locales/en.json';
import zhTWTranslations from '../locales/zh-TW.json';
import zhCNTranslations from '../locales/zh-CN.json';

export type Locale = 'en' | 'zh-TW' | 'zh-CN';

type Translations = typeof enTranslations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const translations: Record<Locale, Translations> = {
  en: enTranslations,
  'zh-TW': zhTWTranslations,
  'zh-CN': zhCNTranslations,
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // 從 localStorage 讀取保存的語言設置，或使用瀏覽器語言
    const saved = localStorage.getItem('locale') as Locale | null;
    if (saved && (saved === 'en' || saved === 'zh-TW' || saved === 'zh-CN')) {
      return saved;
    }
    
    // 檢測瀏覽器語言
    const browserLang = navigator.language;
    if (browserLang.startsWith('zh')) {
      return browserLang === 'zh-CN' ? 'zh-CN' : 'zh-TW';
    }
    return 'en';
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  };

  const t = (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.');
    let value: any = translations[locale];
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string: ${key}`);
      return key;
    }

    // 替換參數
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match: string, paramKey: string) => {
        return params[paramKey] || match;
      });
    }

    return value;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
