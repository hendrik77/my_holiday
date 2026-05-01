import { create } from 'zustand';
import type { ViewType } from '../types';

const MAX_UNDO = 50;

interface UIState {
  year: number;
  view: ViewType;
  selectedMonth: number;
  theme: 'light' | 'dark' | 'auto';
  language: 'de' | 'en';
  // Undo/redo stacks (store serialized period snapshots for undo of deletes)
  _undoStack: string[][]; // arrays of period IDs
  _redoStack: string[][];

  setYear: (year: number) => void;
  setView: (view: ViewType) => void;
  setSelectedMonth: (month: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setLanguage: (language: 'de' | 'en') => void;

  canUndo: boolean;
  canRedo: boolean;
  _popUndo: () => string[] | null;
  _popRedo: () => string[] | null;
  _pushUndoState: (ids: string[]) => void;
}

export const useUIStore = create<UIState>()((set, get) => ({
  year: new Date().getFullYear(),
  view: 'dashboard',
  selectedMonth: new Date().getMonth(),
  theme: 'auto',
  language: 'de',

  _undoStack: [],
  _redoStack: [],

  get canUndo() { return get()._undoStack.length > 0; },
  get canRedo() { return get()._redoStack.length > 0; },

  setYear: (year) => set({ year }),
  setView: (view) => set({ view }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),

  _pushUndoState: (ids) =>
    set((s) => ({
      _undoStack: [...s._undoStack.slice(-(MAX_UNDO - 1)), [...ids]],
      _redoStack: [],
    })),

  _popUndo: () => {
    const stack = get()._undoStack;
    if (stack.length === 0) return null;
    const snapshot = stack[stack.length - 1];
    set((s) => ({ _undoStack: s._undoStack.slice(0, -1) }));
    return snapshot;
  },

  _popRedo: () => {
    const stack = get()._redoStack;
    if (stack.length === 0) return null;
    const snapshot = stack[stack.length - 1];
    set((s) => ({ _redoStack: s._redoStack.slice(0, -1) }));
    return snapshot;
  },
}));
