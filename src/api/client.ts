import type { PeriodRow, Settings, SettingsUpdate, CurrentUser, PublicPat, PatScope } from '../../server/types';
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

/** API failure carrying the HTTP status, so callers can special-case auth. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function doFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // session cookies (oidc mode); harmless otherwise
    ...options,
  });
}

/**
 * Single-flight session refresh: refresh tokens are single-use on the server
 * (rotation family — a second parallel use reads as replay and revokes the
 * whole session), so all concurrent 401s must share ONE refresh request.
 */
let refreshInFlight: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= doFetch('/auth/refresh', { method: 'POST' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * On a 401 the session JWT has likely just expired: join the shared silent
 * refresh and retry the original request once. If the refresh — or the
 * retry itself — still 401s, announce `auth:expired` so the AuthGate can
 * show the login page.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res = await doFetch(path, options);
  if (res.status === 401) {
    if (await refreshSession()) {
      res = await doFetch(path, options);
    }
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:expired'));
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error || `Request failed: ${res.status}`, res.status);
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

// ── Auth ─────────────────────────────────────────────────────────

export function fetchCurrentUser(): Promise<CurrentUser> {
  return request<CurrentUser>('/auth/me');
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

/** Browser navigation target that starts the OIDC login flow. */
export function loginUrl(): string {
  return `${BASE_URL}/auth/login`;
}

// ── API tokens (oidc mode) ───────────────────────────────────────

export function fetchTokens(): Promise<PublicPat[]> {
  return request<PublicPat[]>('/tokens');
}

/** The returned raw token is shown exactly once — it is never retrievable again. */
export function createToken(input: { name: string; scope: PatScope }): Promise<{ token: string; pat: PublicPat }> {
  return request<{ token: string; pat: PublicPat }>('/tokens', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function revokeToken(id: string): Promise<void> {
  return request<void>(`/tokens/${id}`, { method: 'DELETE' });
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
