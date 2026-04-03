/**
 * Multi-language helpers — placeholder alongside i18n JSON (locales/*.json).
 * Use for language codes, display names, or strings that must live in TS.
 */

export const SUPPORTED_LOCALES = ['en', 'zh'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  zh: '中文',
};

/** BCP-47 style hints for formatting dates/numbers if needed later */
export const LOCALE_TAGS: Record<AppLocale, string> = {
  en: 'en-US',
  zh: 'zh-Hans-CN',
};
