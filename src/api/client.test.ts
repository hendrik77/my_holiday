import { describe, it, expect } from 'vitest';
import { resolveApiBaseUrl } from './client';

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
