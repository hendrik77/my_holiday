import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { ListView } from '../ListView';

vi.mock('../../api/hooks', () => ({
  usePeriods: () => ({
    data: [
      { id: '1', startDate: '2026-07-01', endDate: '2026-07-15', note: 'Sommerurlaub', halfDay: false, type: 'urlaub', changedAt: '' },
    ],
    isLoading: false,
    error: null,
  }),
  useSettings: () => ({
    data: { totalDays: 30, state: 'HE', carryOverDays: 0, carryOverDeadline: '03-31', carryOverMaxDays: null, employmentStartDate: '2020-01-01', employmentEndDate: '', bildungsUrlaubDays: 0 },
    isLoading: false,
  }),
  useCreatePeriod: () => ({ mutate: vi.fn() }),
  useUpdatePeriod: () => ({ mutate: vi.fn() }),
  useDeletePeriod: () => ({ mutate: vi.fn() }),
  useUpdateSettings: () => ({ mutate: vi.fn() }),
}));

function renderListView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <ListView />
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('ListView', () => {
  afterEach(() => cleanup());
  it('renders the table with period', () => {
    renderListView();
    expect(screen.getByText('Sommerurlaub')).toBeDefined();
    expect(screen.getByText('Zeitraum')).toBeDefined();
    expect(screen.getByText('Arbeitstage')).toBeDefined();
  });

  it('shows total row', () => {
    renderListView();
    const totals = screen.getAllByText('Gesamt');
    expect(totals.length).toBeGreaterThan(0);
  });
});
