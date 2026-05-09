import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import enFit from '@/locales/fitting-en.json';
import ja from '@/locales/ja.json';
import fittingJa from '@/locales/fitting-ja.json';
import zh from '@/locales/zh.json';
import zhFit from '@/locales/fitting-zh.json';

const enAll = { ...en, ...enFit };
const zhAll = { ...zh, ...zhFit };
const jaAll = { ...ja, ...fittingJa };

export type AppLanguage = 'en' | 'zh' | 'ja';

/**
 * Map device locale list → app language (`en` | `zh` | `ja`).
 * Uses preferred system languages in order (same as OS language picker).
 */
export function resolveAppLanguage(
  locales: readonly { languageCode?: string | null; languageTag?: string | null }[],
): AppLanguage {
  for (const loc of locales) {
    const code = (loc.languageCode ?? '').toLowerCase();
    if (code === 'ja' || code.startsWith('ja')) return 'ja';
    if ((loc.languageTag ?? '').toLowerCase().startsWith('ja')) return 'ja';
    if (code === 'zh' || code.startsWith('zh')) return 'zh';
    if (code === 'en' || code.startsWith('en')) return 'en';
    const tag = (loc.languageTag ?? '').toLowerCase();
    if (tag.startsWith('zh')) return 'zh';
    if (tag.startsWith('en')) return 'en';
  }
  return 'zh';
}

/** Sync init before AsyncStorage hydrates; LocaleSync applies saved preference. */
function initialLanguage(): AppLanguage {
  return 'zh';
}

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  lng: initialLanguage(),
  fallbackLng: 'zh',
  resources: {
    en: { translation: enAll },
    zh: { translation: zhAll },
    ja: { translation: jaAll },
  },
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
