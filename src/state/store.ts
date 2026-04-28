import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VacationState, VacationActions, VacationPeriod, ViewType } from '../types';
import type { GermanState } from '../data/holidays';
import type { Language } from '../i18n/translations';

type Store = VacationState & VacationActions;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      // State
      year: new Date().getFullYear(),
      totalDays: 30,
      state: 'HE' as GermanState,
      language: 'de' as Language,
      periods: [],
      view: 'dashboard',
      selectedMonth: new Date().getMonth(),

      // Actions
      setYear: (year) => set({ year }),
      setTotalDays: (totalDays) => set({ totalDays }),
      setView: (view) => set({ view }),
      setSelectedMonth: (month) => set({ selectedMonth: month }),

      addPeriod: (period) =>
        set((state) => ({
          periods: [...state.periods, { ...period, id: generateId() }],
        })),

      updatePeriod: (id, updates) =>
        set((state) => ({
          periods: state.periods.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        })),

      removePeriod: (id) =>
        set((state) => ({
          periods: state.periods.filter((p) => p.id !== id),
        })),

      importData: (totalDays, periods) =>
        set(() => ({
          totalDays,
          periods: periods.map((p) => ({ ...p, id: generateId() })),
        })),

      setState: (state) => set({ state }),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'my-holiday-storage',
    }
  )
);
