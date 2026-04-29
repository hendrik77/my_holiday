import { useCallback, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { translations, type Language } from './translations';
import { I18nContext, type TranslationParams } from './useT';

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useStore((s) => s.language);

  const resolve = useCallback(
    (key: string) => {
      const lang = language as Language;
      const keys = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = translations[lang];
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // Fallback to German
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let fallback: any = translations.de;
          for (const fk of keys) {
            if (fallback && typeof fallback === 'object' && fk in fallback) {
              fallback = fallback[fk];
            } else {
              return key;
            }
          }
          value = fallback;
          break;
        }
      }
      return value;
    },
    [language]
  );

  const t = useCallback(
    (key: string, params?: TranslationParams) => {
      const value = resolve(key);

      if (typeof value !== 'string') return key;

      if (params) {
        return value.replace(/\{(\w+)\}/g, (_, param) => {
          return params[param]?.toString() ?? `{${param}}`;
        });
      }

      return value;
    },
    [resolve]
  );

  const tRaw = useCallback(
    <T,>(key: string): T => {
      const value = resolve(key);
      return (value !== key ? value : key) as T;
    },
    [resolve]
  );

  return (
    <I18nContext.Provider value={{ t, tRaw, lang: language }}>
      {children}
    </I18nContext.Provider>
  );
}
