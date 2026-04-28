import { describe, it, expect } from 'vitest';
import { translations } from './translations';

function getAllKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('translations', () => {
  it('has both languages', () => {
    expect(translations.de).toBeDefined();
    expect(translations.en).toBeDefined();
  });

  it('has same keys in both languages', () => {
    const deKeys = new Set(getAllKeys(translations.de));
    const enKeys = new Set(getAllKeys(translations.en));

    const onlyInDe = [...deKeys].filter((k) => !enKeys.has(k));
    const onlyInEn = [...enKeys].filter((k) => !deKeys.has(k));

    expect(onlyInDe).toEqual([]);
    expect(onlyInEn).toEqual([]);
  });

  it('has no empty translation values', () => {
    for (const lang of ['de', 'en'] as const) {
      const keys = getAllKeys(translations[lang]);
      for (const key of keys) {
        const value = key.split('.').reduce((obj: unknown, k) => {
          if (obj && typeof obj === 'object' && k in obj) {
            return (obj as Record<string, unknown>)[k];
          }
          return undefined;
        }, translations[lang]);
        if (typeof value === 'string') {
          expect(value.length, `Empty translation: ${lang}.${key}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
