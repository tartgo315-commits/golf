import { useLocales } from 'expo-localization';
import { useEffect } from 'react';

import i18n, { resolveAppLanguage } from '@/lib/i18n';

/**
 * Syncs i18n with the device / browser preferred language list.
 * `useLocales` only updates when the OS language settings change, so manual
 * in-app toggles are not overwritten until the user changes system language again.
 */
export function LocaleSync() {
  const locales = useLocales();

  useEffect(() => {
    const next = resolveAppLanguage(locales);
    void i18n.changeLanguage(next);
  }, [locales]);

  return null;
}
