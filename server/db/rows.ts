import type { PeriodRow, Settings, SettingsUpdate, UserRow, UserRole } from '../types';
import type { RefreshTokenRow } from './types';

/**
 * Map a raw `periods` row to the API shape. Shared by both drivers:
 * SQLite stores half_day as INTEGER 0/1, PostgreSQL as BOOLEAN.
 */
export function rowToPeriod(row: Record<string, unknown>): PeriodRow {
  return {
    id: row.id as string,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    note: row.note as string,
    halfDay: row.half_day === 1 || row.half_day === true,
    type: ((row.type as string) || 'urlaub') as PeriodRow['type'],
    changedAt: row.changed_at as string,
  };
}

/** Map a raw `users` row to the API shape. Shared by both drivers. */
export function rowToUser(row: Record<string, unknown>): UserRow {
  return {
    id: row.id as string,
    oidcSub: (row.oidc_sub as string | null) ?? null,
    email: row.email as string,
    name: row.name as string,
    team: row.team as string,
    role: row.role as UserRole,
    managerId: (row.manager_id as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Map a raw `refresh_tokens` row to the API shape. Shared by both drivers. */
export function rowToRefreshToken(row: Record<string, unknown>): RefreshTokenRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    tokenHash: row.token_hash as string,
    familyId: row.family_id as string,
    expiresAt: row.expires_at as string,
    rotatedAt: (row.rotated_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Typed Settings from key-value rows; missing keys fall back to defaults.
 * Shared by both drivers so defaults can never drift between backends.
 */
export function settingsFromRows(rows: Array<{ key: string; value: string }>): Settings {
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    totalDays: parseInt(map.get('totalDays') || '30', 10),
    state: map.get('state') || 'HE',
    carryOverDays: parseInt(map.get('carryOverDays') || '0', 10),
    carryOverDeadline: map.get('carryOverDeadline') || '03-31',
    carryOverMaxDays: map.get('carryOverMaxDays') ? parseInt(map.get('carryOverMaxDays')!, 10) : null,
    employmentStartDate: map.get('employmentStartDate') || '',
    employmentEndDate: map.get('employmentEndDate') || '',
    bildungsUrlaubDays: parseInt(map.get('bildungsUrlaubDays') || '0', 10),
  };
}

/** SettingsUpdate → key-value upsert pairs, one per provided field. */
export function settingsUpdateEntries(updates: SettingsUpdate): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  if (updates.totalDays !== undefined) entries.push(['totalDays', String(updates.totalDays)]);
  if (updates.state !== undefined) entries.push(['state', updates.state]);
  if (updates.carryOverDays !== undefined) entries.push(['carryOverDays', String(updates.carryOverDays)]);
  if (updates.carryOverDeadline !== undefined) entries.push(['carryOverDeadline', updates.carryOverDeadline]);
  if (updates.carryOverMaxDays !== undefined)
    entries.push(['carryOverMaxDays', updates.carryOverMaxDays === null ? '' : String(updates.carryOverMaxDays)]);
  if (updates.employmentStartDate !== undefined) entries.push(['employmentStartDate', updates.employmentStartDate]);
  if (updates.employmentEndDate !== undefined) entries.push(['employmentEndDate', updates.employmentEndDate]);
  if (updates.bildungsUrlaubDays !== undefined) entries.push(['bildungsUrlaubDays', String(updates.bildungsUrlaubDays)]);
  return entries;
}
