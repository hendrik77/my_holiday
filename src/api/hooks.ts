import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchPeriods,
  createPeriod,
  updatePeriod,
  deletePeriod,
  fetchSettings,
  updateSettings,
  fetchCurrentUser,
  logout,
  fetchTokens,
  createToken,
  revokeToken,
} from './client';
import type { PatScope } from '../../server/types';
import type { PeriodRow, SettingsUpdate } from '../../server/types';
import type { CreatePeriodInput } from '../../server/types';

// ── Periods ──────────────────────────────────────────────────────

export function usePeriods(year: number) {
  return useQuery({
    queryKey: ['periods', year],
    queryFn: () => fetchPeriods(year),
    staleTime: 30_000,
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePeriodInput) => createPeriod(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

export function useUpdatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<PeriodRow> }) =>
      updatePeriod(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

export function useDeletePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePeriod(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

// ── Auth ─────────────────────────────────────────────────────────

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
    retry: false, // a 401 already went through the silent-refresh path
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear();
      window.location.assign('/');
    },
  });
}

// ── API tokens (oidc mode) ───────────────────────────────────────

export function useTokens() {
  return useQuery({ queryKey: ['tokens'], queryFn: fetchTokens });
}

export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; scope: PatScope }) => createToken(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tokens'] });
    },
  });
}

export function useRevokeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revokeToken(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tokens'] });
    },
  });
}

// ── Settings ─────────────────────────────────────────────────────

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: SettingsUpdate) => updateSettings(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
