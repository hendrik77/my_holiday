import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VacationState, VacationActions, VacationPeriod, ViewType } from '../types';

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
    }),
    {
      name: 'my-holiday-storage',
    }
  )
);
