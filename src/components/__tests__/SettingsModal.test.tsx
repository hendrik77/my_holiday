import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { SettingsModal } from '../SettingsModal';

vi.mock('../../api/hooks', () => ({
  useSettings: () => ({
    data: { totalDays: 30, state: 'HE', carryOverDays: 0, carryOverDeadline: '03-31', carryOverMaxDays: null, employmentStartDate: '', employmentEndDate: '', bildungsUrlaubDays: 0 },
    isLoading: false,
  }),
  usePeriods: () => ({ data: [], isLoading: false }),
  useUpdateSettings: () => ({ mutate: vi.fn() }),
  useCreatePeriod: () => ({ mutate: vi.fn() }),
}));

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <SettingsModal onClose={onClose} />
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('SettingsModal', () => {
  afterEach(() => cleanup());

  it('renders the settings title', () => {
    renderModal();
    expect(screen.getByText(/Einstellungen|Settings/)).toBeDefined();
  });

  it('shows import and export buttons', () => {
    renderModal();
    expect(screen.getByTitle(/Urlaubsdaten aus CSV importieren|Import vacation data from CSV/)).toBeDefined();
    expect(screen.getByTitle(/Urlaubsdaten als CSV exportieren|Export vacation data as CSV/)).toBeDefined();
  });

  it('import button triggers file input click', () => {
    renderModal();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');
    fireEvent.click(screen.getByTitle(/Urlaubsdaten aus CSV importieren|Import vacation data from CSV/));
    expect(clickSpy).toHaveBeenCalled();
  });
});
