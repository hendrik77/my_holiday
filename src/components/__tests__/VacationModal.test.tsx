import { describe, it, expect, vi, afterEach, beforeEach, afterAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { VacationModal } from '../VacationModal';
import type { VacationPeriod } from '../../types';

let mockYear = 2026;

vi.mock('../../api/hooks', () => ({
  usePeriods: () => ({ data: [], isLoading: false }),
  useSettings: () => ({
    data: { totalDays: 30, state: 'HE', carryOverDays: 0, carryOverDeadline: '03-31', carryOverMaxDays: null, employmentStartDate: '', employmentEndDate: '', bildungsUrlaubDays: 0 },
    isLoading: false,
  }),
  useCreatePeriod: () => ({ mutate: vi.fn() }),
  useUpdatePeriod: () => ({ mutate: vi.fn() }),
}));

vi.mock('../../state/store', () => ({
  useUIStore: <T,>(selector: (s: { year: number }) => T): T => selector({ year: mockYear }),
}));

const existingPeriod: VacationPeriod = {
  id: 'abc-123',
  startDate: '2026-07-01',
  endDate: '2026-07-05',
  note: 'Sommerurlaub',
  halfDay: false,
  type: 'urlaub',
};

function renderModal(props: Parameters<typeof VacationModal>[0]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <VacationModal {...props} />
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('VacationModal', () => {
  afterEach(() => cleanup());

  it('renders the new vacation modal', () => {
    renderModal({ onClose: vi.fn() });
    expect(screen.getByText(/Neuer Urlaub|New Vacation/)).toBeDefined();
  });

  it('does not show iCal download button in new-vacation mode', () => {
    renderModal({ onClose: vi.fn() });
    expect(screen.queryByText(/Als iCal herunterladen|Download as iCal/)).toBeNull();
  });

  it('shows iCal download button in edit mode', () => {
    renderModal({ onClose: vi.fn(), initial: existingPeriod });
    expect(screen.getByText(/Als iCal herunterladen|Download as iCal/)).toBeDefined();
  });

  it('iCal download button triggers download in edit mode', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });
    renderModal({ onClose: vi.fn(), initial: existingPeriod });
    const btn = screen.getByText(/Als iCal herunterladen|Download as iCal/);
    btn.click();
    expect(createObjectURL).toHaveBeenCalled();
  });

  describe('default dates', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 9, 10, 0, 0)); // 2026-05-09
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("defaults start and end date to today when browsing the current year", () => {
      mockYear = 2026;
      renderModal({ onClose: vi.fn() });
      const dateInputs = screen.getAllByDisplayValue('2026-05-09');
      expect(dateInputs).toHaveLength(2);
    });

    it('defaults start and end date to Jan 1 when browsing a future year', () => {
      mockYear = 2027;
      renderModal({ onClose: vi.fn() });
      const dateInputs = screen.getAllByDisplayValue('2027-01-01');
      expect(dateInputs).toHaveLength(2);
    });

    it('still honors presetDates over the today fallback', () => {
      mockYear = 2026;
      renderModal({
        onClose: vi.fn(),
        presetDates: { startDate: '2026-09-10', endDate: '2026-09-12' },
      });
      expect(screen.getByDisplayValue('2026-09-10')).toBeDefined();
      expect(screen.getByDisplayValue('2026-09-12')).toBeDefined();
    });
  });
});
