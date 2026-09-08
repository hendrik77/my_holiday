import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { Dashboard } from '../Dashboard';

// Dashboard filters "upcoming" by endDate >= today (see Dashboard.tsx), so
// fixture dates must stay relative to today rather than hardcoded — a fixed
// date eventually lands in the past and silently drops out of the list.
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Mock the API hooks
vi.mock('../../api/hooks', () => ({
  usePeriods: () => ({
    data: [
      { id: '1', startDate: isoDaysFromNow(10), endDate: isoDaysFromNow(24), note: 'Sommerurlaub', halfDay: false, type: 'urlaub', changedAt: '' },
      { id: '2', startDate: isoDaysFromNow(60), endDate: isoDaysFromNow(60), note: 'Weihnachten', halfDay: true, type: 'urlaub', changedAt: '' },
    ],
    isLoading: false,
    error: null,
  }),
  useSettings: () => ({
    data: {
      totalDays: 30,
      state: 'HE',
      carryOverDays: 5,
      carryOverDeadline: '03-31',
      carryOverMaxDays: null,
      employmentStartDate: '2020-01-01',
      employmentEndDate: '',
      bildungsUrlaubDays: 0,
    },
    isLoading: false,
  }),
  useCreatePeriod: () => ({ mutate: vi.fn() }),
  useUpdatePeriod: () => ({ mutate: vi.fn() }),
  useDeletePeriod: () => ({ mutate: vi.fn() }),
  useUpdateSettings: () => ({ mutate: vi.fn() }),
}));

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <Dashboard />
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('Dashboard', () => {
  afterEach(() => cleanup());
  it('renders stats cards', () => {
    renderDashboard();
    expect(screen.getByText('Genutzt')).toBeDefined();
    expect(screen.getByText('Verbleibend')).toBeDefined();
    expect(screen.getByText('Gesamt')).toBeDefined();
  });

  it('renders upcoming vacations', () => {
    renderDashboard();
    const items = screen.getAllByText('Sommerurlaub');
    expect(items.length).toBeGreaterThan(0);
    const weihnachten = screen.getAllByText('Weihnachten');
    expect(weihnachten.length).toBeGreaterThan(0);
  });

  it('renders carry-over card when carryOverDays > 0', () => {
    renderDashboard();
    expect(screen.getByText('Übertrag Vorjahr')).toBeDefined();
  });

  it('renders plan vacation button', () => {
    renderDashboard();
    expect(screen.getByText('+ Urlaub planen')).toBeDefined();
  });
});
