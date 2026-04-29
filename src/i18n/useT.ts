import { createContext, useContext } from 'react';
import type { Language } from './translations';

export type TranslationParams = Record<string, string | number>;

export const I18nContext = createContext<{
  t: (key: string, params?: TranslationParams) => string;
  tRaw: <T = string | string[]>(key: string) => T;
  lang: Language;
}>({ t: (k) => k, tRaw: (k) => k as never, lang: 'de' });

export function useT() {
  return useContext(I18nContext);
}
