import { create } from 'zustand';
import type { ViewType } from '../types';

interface UIState {
  year: number;
  view: ViewType;
  selectedMonth: number;
  theme: 'light' | 'dark' | 'auto';
  language: 'de' | 'en';

  setYear: (year: number) => void;
  setView: (view: ViewType) => void;
  setSelectedMonth: (month: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setLanguage: (language: 'de' | 'en') => void;
}

export const useUIStore = create<UIState>()((set) => ({
  year: new Date().getFullYear(),
  view: 'dashboard',
  selectedMonth: new Date().getMonth(),
  theme: 'auto',
  language: 'de',

  setYear: (year) => set({ year }),
  setView: (view) => set({ view }),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}));
