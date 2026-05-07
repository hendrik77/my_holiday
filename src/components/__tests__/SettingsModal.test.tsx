import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { SettingsModal } from '../SettingsModal';

const mockMutate = vi.fn();

vi.mock('../../api/hooks', () => ({
  useSettings: () => ({
    data: { totalDays: 30, state: 'HE', carryOverDays: 0, carryOverDeadline: '03-31', carryOverMaxDays: null, employmentStartDate: '2020-03-01', employmentEndDate: '', bildungsUrlaubDays: 0 },
    isLoading: false,
  }),
  usePeriods: () => ({ data: [], isLoading: false }),
  useUpdateSettings: () => ({ mutate: mockMutate }),
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
  afterEach(() => { cleanup(); mockMutate.mockClear(); });

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

  it('shows employment start date field with existing value', () => {
    renderModal();
    expect(screen.getByText(/Beschäftigt seit|Employed since/)).toBeDefined();
    const input = document.querySelector('input[name="employmentStartDate"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('2020-03-01');
  });

  it('shows employment end date field', () => {
    renderModal();
    expect(screen.getByText(/Beschäftigt bis|Employed until/)).toBeDefined();
    expect(document.querySelector('input[name="employmentEndDate"]')).not.toBeNull();
  });

  it('saves employment dates on Save', () => {
    renderModal();
    fireEvent.click(screen.getByText(/Speichern|Save/));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ employmentStartDate: '2020-03-01' })
    );
  });

  it('saves changed employment start date', () => {
    renderModal();
    const input = document.querySelector('input[name="employmentStartDate"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2019-06-15' } });
    fireEvent.click(screen.getByText(/Speichern|Save/));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ employmentStartDate: '2019-06-15' })
    );
  });
});
