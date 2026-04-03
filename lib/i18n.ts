import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import enFit from '@/locales/fitting-en.json';
import zh from '@/locales/zh.json';
import zhFit from '@/locales/fitting-zh.json';

const enAll = { ...en, ...enFit };
const zhAll = { ...zh, ...zhFit };

export type AppLanguage = 'en' | 'zh';

/**
 * Map device locale list → app language (`en` | `zh`).
 * Uses preferred system languages in order (same as OS language picker).
 */
export function resolveAppLanguage(
  locales: readonly { languageCode?: string | null; languageTag?: string | null }[],
): AppLanguage {
  for (const loc of locales) {
    const code = (loc.languageCode ?? '').toLowerCase();
    if (code === 'zh' || code.startsWith('zh')) return 'zh';
    if (code === 'en' || code.startsWith('en')) return 'en';
    const tag = (loc.languageTag ?? '').toLowerCase();
    if (tag.startsWith('zh')) return 'zh';
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
}

function initialLanguage(): AppLanguage {
  try {
    const list = Localization.getLocales();
    if (list.length > 0) {
      return resolveAppLanguage(list);
    }
  } catch {
    /* web / tests */
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  lng: initialLanguage(),
  fallbackLng: 'en',
  resources: {
    en: { translation: enAll },
    zh: { translation: zhAll },
  },
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
