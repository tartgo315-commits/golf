import { useEffect } from 'react';

import { loadStoredAppLanguage } from '@/lib/app-language-storage';
import i18n from '@/lib/i18n';

/**
 * Applies persisted language, or defaults to Chinese. Auth screens also persist
 * via the language toggle.
 */
export function LocaleSync() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadStoredAppLanguage();
      if (cancelled) return;
      if (stored) {
        await i18n.changeLanguage(stored);
        return;
      }
      await i18n.changeLanguage('zh');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
