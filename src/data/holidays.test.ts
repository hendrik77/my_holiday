import { describe, it, expect } from 'vitest';
import { getHolidayMap, GERMAN_STATES } from './holidays';

describe('getHolidayMap', () => {
  it('returns holidays for Hessen', () => {
    const map = getHolidayMap(2026, 2026, 'HE');
    // Hessen has 10 holidays (9 nationwide + Fronleichnam)
    expect(map.size).toBeGreaterThanOrEqual(9);
    expect(map.has('2026-01-01')).toBe(true); // Neujahr
    expect(map.has('2026-12-25')).toBe(true); // 1. Weihnachtstag
  });

  it('returns more holidays for Bayern than Hessen', () => {
    const he = getHolidayMap(2026, 2026, 'HE');
    const by = getHolidayMap(2026, 2026, 'BY');
    expect(by.size).toBeGreaterThan(he.size);
  });

  it('returns exact count for a single year', () => {
    const map = getHolidayMap(2026, 2026, 'HE');
    expect(map.size).toBe(10);
  });

  it('returns German holiday names', () => {
    const map = getHolidayMap(2026, 2026, 'HE');
    expect(map.get('2026-01-01')).toBe('Neujahrstag');
    expect(map.get('2026-12-25')).toBe('1. Weihnachtstag');
  });

  it('covers multiple years', () => {
    const map = getHolidayMap(2025, 2027, 'HE');
    // Should have ~30 entries (10 per year)
    expect(map.size).toBeGreaterThanOrEqual(27);
  });
});

describe('GERMAN_STATES', () => {
  it('has all 16 states', () => {
    expect(GERMAN_STATES).toHaveLength(16);
  });

  it('each state has a code and name', () => {
    for (const s of GERMAN_STATES) {
      expect(s.code).toBeTruthy();
      expect(s.code.length).toBe(2);
      expect(s.name).toBeTruthy();
    }
  });

  it('provides state codes in feiertagejs Region format', () => {
    const validCodes = ['BW', 'BY', 'BE', 'BB', 'HB', 'HE', 'HH', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
    for (const s of GERMAN_STATES) {
      expect(validCodes).toContain(s.code);
    }
  });
});
