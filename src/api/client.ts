import type { PeriodRow, Settings, SettingsUpdate } from '../../server/types';
import type { CreatePeriodInput } from '../../server/types';

const BASE_URL = 'http://localhost:3001/api/v1';

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
