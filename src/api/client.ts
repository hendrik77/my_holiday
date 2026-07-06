import type { PeriodRow, Settings, SettingsUpdate } from '../../server/types';
import type { CreatePeriodInput } from '../../server/types';

export interface ApiBaseUrlEnv {
  readonly PROD?: boolean;
  readonly VITE_API_BASE_URL?: string;
}

/**
 * Resolve the API base URL. In production the SPA is served by the API server
 * itself, so a relative path works from any host (localhost, LAN, reverse
 * proxy). During development the Vite dev server (5173) talks to the separate
 * API process on port 3001. VITE_API_BASE_URL overrides both at build time.
 */
export function resolveApiBaseUrl(env: ApiBaseUrlEnv): string {
  if (env.VITE_API_BASE_URL) return env.VITE_API_BASE_URL;
  return env.PROD ? '/api/v1' : 'http://localhost:3001/api/v1';
}

const BASE_URL = resolveApiBaseUrl(import.meta.env);

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Periods ──────────────────────────────────────────────────────

export function fetchPeriods(year: number): Promise<PeriodRow[]> {
  return request<PeriodRow[]>(`/periods?year=${year}`);
}

export function createPeriod(input: CreatePeriodInput): Promise<PeriodRow> {
  return request<PeriodRow>('/periods', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePeriod(
  id: string,
  updates: Partial<Pick<PeriodRow, 'startDate' | 'endDate' | 'note' | 'halfDay' | 'type'>>
): Promise<PeriodRow> {
  return request<PeriodRow>(`/periods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export function deletePeriod(id: string): Promise<void> {
  return request<void>(`/periods/${id}`, { method: 'DELETE' });
}

// ── Settings ─────────────────────────────────────────────────────

export function fetchSettings(): Promise<Settings> {
  return request<Settings>('/settings');
}

export function updateSettings(updates: SettingsUpdate): Promise<Settings> {
  return request<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}
