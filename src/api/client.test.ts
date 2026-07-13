import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveApiBaseUrl, fetchSettings, fetchPeriods } from './client';

describe('resolveApiBaseUrl', () => {
  it('prefers an explicit VITE_API_BASE_URL over everything else', () => {
    expect(
      resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://holiday.example.lan/api/v1', PROD: true }),
    ).toBe('https://holiday.example.lan/api/v1');
    expect(
      resolveApiBaseUrl({ VITE_API_BASE_URL: 'http://127.0.0.1:4000/api/v1', PROD: false }),
    ).toBe('http://127.0.0.1:4000/api/v1');
  });

  it('uses a relative /api/v1 in production builds so the SPA works from any host', () => {
    // In production the API server serves the SPA itself — an absolute
    // localhost URL would break access from other devices (NAS, Pi, LAN).
    expect(resolveApiBaseUrl({ PROD: true })).toBe('/api/v1');
  });

  it('falls back to the local API server during development', () => {
    expect(resolveApiBaseUrl({ PROD: false })).toBe('http://localhost:3001/api/v1');
  });

  it('ignores an empty VITE_API_BASE_URL', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: '', PROD: true })).toBe('/api/v1');
  });
});

describe('session-expiry handling (401 → refresh → retry)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('sends cookies with every request', async () => {
    fetchMock.mockResolvedValueOnce(json({ totalDays: 30 }));
    await fetchSettings();
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include');
  });

  it('retries the original request once after a successful refresh', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: 'Authentication required' }, 401))
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // POST /auth/refresh
      .mockResolvedValueOnce(json({ totalDays: 28 }));

    const settings = await fetchSettings();
    expect(settings.totalDays).toBe(28);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/refresh');
    expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');
  });

  it('dispatches auth:expired and rejects when the refresh also fails', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: 'Authentication required' }, 401))
      .mockResolvedValueOnce(json({ error: 'Session expired' }, 401));

    const expired = vi.fn();
    window.addEventListener('auth:expired', expired);
    try {
      await expect(fetchSettings()).rejects.toThrow();
      expect(expired).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2); // no second retry loop
    } finally {
      window.removeEventListener('auth:expired', expired);
    }
  });

  it('concurrent 401s share a single refresh request (single-flight)', async () => {
    // Two queries expire at once. The refresh token is single-use on the
    // server (rotation family), so a second parallel POST /auth/refresh
    // would be treated as replay and revoke the whole session.
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 5)); // let both 401s queue up
        return new Response(null, { status: 204 });
      }
      // First hit per endpoint: 401; after the refresh: 200.
      if (refreshCalls === 0) return json({ error: 'Authentication required' }, 401);
      if (url.includes('/settings')) return json({ totalDays: 30 });
      return json([]);
    });

    const [settings, periods] = await Promise.all([fetchSettings(), fetchPeriods(2026)]);
    expect(settings.totalDays).toBe(30);
    expect(periods).toEqual([]);
    expect(refreshCalls).toBe(1);
  });

  it('dispatches auth:expired when the retried request itself 401s again', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: 'Authentication required' }, 401))
      .mockResolvedValueOnce(new Response(null, { status: 204 })) // refresh ok
      .mockResolvedValueOnce(json({ error: 'Authentication required' }, 401)); // retry still 401

    const expired = vi.fn();
    window.addEventListener('auth:expired', expired);
    try {
      await expect(fetchSettings()).rejects.toThrow();
      expect(expired).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(3); // no endless retry loop
    } finally {
      window.removeEventListener('auth:expired', expired);
    }
  });

  it('does not treat non-401 errors as session expiry', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'boom' }, 500));
    const expired = vi.fn();
    window.addEventListener('auth:expired', expired);
    try {
      await expect(fetchSettings()).rejects.toThrow('boom');
      expect(expired).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('auth:expired', expired);
    }
  });
});
