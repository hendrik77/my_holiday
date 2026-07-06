import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchSchoolHolidays, buildSchoolHolidayDaySet } from './schoolHolidays';

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchJson(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => payload }));
}

describe('fetchSchoolHolidays', () => {
  it('returns validated periods from the API', async () => {
    mockFetchJson([{ name: 'Sommerferien', start: '2026-07-06T00:00', end: '2026-08-14T00:00' }]);
    const periods = await fetchSchoolHolidays('HE', 2026);
    expect(periods).toHaveLength(1);
    expect(periods[0].name).toBe('Sommerferien');
  });

  it('filters malformed entries instead of caching garbage', async () => {
    mockFetchJson([
      { name: 'OK', start: '2026-10-05', end: '2026-10-16' },
      { name: 42, start: '2026-10-05', end: '2026-10-16' },
      { name: 'bad dates', start: 'not-a-date', end: '2026-10-16' },
      null,
      'just a string',
    ]);
    const periods = await fetchSchoolHolidays('HE', 2026);
    expect(periods).toHaveLength(1);
    expect(periods[0].name).toBe('OK');
  });

  it('falls back to built-in data when the response is not an array', async () => {
    mockFetchJson({ error: 'unexpected shape' });
    const periods = await fetchSchoolHolidays('HE', 2026);
    expect(periods.length).toBeGreaterThan(0);
    expect(periods[0].name).toBe('Osterferien');
  });

  it('falls back to built-in data when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const periods = await fetchSchoolHolidays('HE', 2026);
    expect(periods[0].name).toBe('Osterferien');
  });
});

describe('buildSchoolHolidayDaySet', () => {
  it('covers every day of each period and fetches year-1..year+1', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ name: 'Herbstferien', start: '2026-10-05', end: '2026-10-07' }],
    });
    vi.stubGlobal('fetch', fetchMock);

    const days = await buildSchoolHolidayDaySet('HE', 2026);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(days.has('2026-10-05')).toBe(true);
    expect(days.has('2026-10-06')).toBe(true);
    expect(days.has('2026-10-07')).toBe(true);
    expect(days.has('2026-10-08')).toBe(false);
  });

  it('skips absurdly long periods so a bad API response cannot blow up the cache', async () => {
    mockFetchJson([{ name: 'evil', start: '2000-01-01', end: '2999-12-31' }]);
    const days = await buildSchoolHolidayDaySet('HE', 2026);
    expect(days.size).toBe(0);
  });
});
