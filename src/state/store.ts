import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VacationState, VacationActions } from '../types';
import type { GermanState } from '../data/holidays';
import type { Language } from '../i18n/translations';
import { computeAutoCarryOver } from '../utils/calendar';

const MAX_UNDO = 50;

type Store = VacationState & VacationActions;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // State
      year: new Date().getFullYear(),
      totalDays: 30,
      carryOverDays: 0,
      state: 'HE' as GermanState,
      language: 'de' as Language,
      theme: 'auto' as const,
      periods: [],
      view: 'dashboard',
      selectedMonth: new Date().getMonth(),
      // Employment
      employmentStartDate: '',
      employmentEndDate: '',
      // Carry-over policy
      carryOverDeadline: '03-31',
      carryOverMaxDays: null,
      // Bildungsurlaub
      bildungsUrlaubDays: 0,

      // Undo/redo stacks (not persisted)
      _undoStack: [],
      _redoStack: [],

      // Derived
      get canUndo() { return get()._undoStack.length > 0; },
      get canRedo() { return get()._redoStack.length > 0; },

      // Push current periods before mutating
      _pushUndo: () =>
        set((s) => ({
          _undoStack: [...s._undoStack.slice(-(MAX_UNDO - 1)), [...s.periods]],
          _redoStack: [],
        })),

      // Actions
      setYear: (year) => {
        const { periods, totalDays, state } = get();
        const carryOverDays = computeAutoCarryOver(periods, year - 1, state, totalDays);
        set({ year, carryOverDays });
      },
      setTotalDays: (totalDays) => set({ totalDays }),
      setCarryOverDays: (carryOverDays) => set({ carryOverDays }),
      setView: (view) => set({ view }),
      setSelectedMonth: (month) => set({ selectedMonth: month }),

      addPeriod: (period) => {
        get()._pushUndo();
        set((state) => ({
          periods: [...state.periods, { ...period, id: generateId() }],
        }));
      },

      updatePeriod: (id, updates) => {
        get()._pushUndo();
        set((state) => ({
          periods: state.periods.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));
      },

      removePeriod: (id) => {
        get()._pushUndo();
        set((state) => ({
          periods: state.periods.filter((p) => p.id !== id),
        }));
      },

      importData: (totalDays, periods) => {
        get()._pushUndo();
        set(() => ({
          totalDays,
          periods: periods.map((p) => ({ ...p, id: generateId() })),
        }));
      },

      undo: () => {
        const { _undoStack, periods } = get();
        if (_undoStack.length === 0) return;
        const prev = _undoStack[_undoStack.length - 1];
        set((s) => ({
          _undoStack: s._undoStack.slice(0, -1),
          _redoStack: [...s._redoStack, [...periods]],
          periods: prev,
        }));
      },

      redo: () => {
        const { _redoStack, periods } = get();
        if (_redoStack.length === 0) return;
        const next = _redoStack[_redoStack.length - 1];
        set((s) => ({
          _redoStack: s._redoStack.slice(0, -1),
          _undoStack: [...s._undoStack, [...periods]],
          periods: next,
        }));
      },

      setState: (state) => set({ state }),
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setEmploymentStartDate: (employmentStartDate) => set({ employmentStartDate }),
      setEmploymentEndDate: (employmentEndDate) => set({ employmentEndDate }),
      setCarryOverDeadline: (carryOverDeadline) => set({ carryOverDeadline }),
      setCarryOverMaxDays: (carryOverMaxDays) => set({ carryOverMaxDays }),
      setBildungsUrlaubDays: (bildungsUrlaubDays) => set({ bildungsUrlaubDays }),
    }),
    {
      name: 'my-holiday-storage',
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _undoStack, _redoStack, ...persisted } = state;
        return persisted;
      },
    }
  )
);
