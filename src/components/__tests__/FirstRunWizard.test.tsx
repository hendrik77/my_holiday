import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { FirstRunWizard } from '../FirstRunWizard';

const mockMutate = vi.fn((_data: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
vi.mock('../../api/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/hooks')>(),
  useUpdateSettings: () => ({ mutate: mockMutate, isPending: false }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWizard(props: { onClose: () => void }) {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <FirstRunWizard {...props} />
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('FirstRunWizard', () => {
  let onCloseCalls: number;

  beforeEach(() => {
    onCloseCalls = 0;
    mockMutate.mockClear();
  });

  function fillEmplStart() {
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2020-01-01' } });
  }

  afterEach(() => {
    cleanup();
  });

  it('renders the welcome title', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    expect(screen.getByText(/Willkommen|Welcome/)).toBeDefined();
  });

  it('shows step 1 (employment) initially', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    expect(screen.getByText(/Beschäftigt seit|Employed since/)).toBeDefined();
  });

  it('has a Next button that advances steps', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    fillEmplStart();
    fireEvent.click(screen.getByText(/Weiter|Next/));
    const stepsEl = document.querySelector('.wizard-steps');
    expect(stepsEl!.textContent).toContain('2');
  });

  it('blocks Next on step 1 when employment start date is empty', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    fireEvent.click(screen.getByText(/Weiter|Next/));
    // Still on step 1
    const stepsEl = document.querySelector('.wizard-steps');
    expect(stepsEl!.textContent).toContain('1');
    expect(screen.getByText(/Beschäftigt seit|Employed since|startDateRequired|start date/i)).toBeDefined();
  });

  it('has a Back button on step 2', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    fillEmplStart();
    fireEvent.click(screen.getByText(/Weiter|Next/));
    const backBtn = screen.getByText(/Zurück|Back/);
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn);
    expect(screen.getByText(/Beschäftigt seit|Employed since/)).toBeDefined();
  });

  it('shows Finish button on last step', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    fillEmplStart();
    fireEvent.click(screen.getByText(/Weiter|Next/));
    fireEvent.click(screen.getByText(/Weiter|Next/));
    fireEvent.click(screen.getByText(/Weiter|Next/));
    expect(screen.getByText(/Fertigstellen|Finish/)).toBeDefined();
  });

  it('calls onClose when Finish is clicked', async () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    fillEmplStart();
    fireEvent.click(screen.getByText(/Weiter|Next/));
    fireEvent.click(screen.getByText(/Weiter|Next/));
    fireEvent.click(screen.getByText(/Weiter|Next/));

    await act(async () => {
      fireEvent.click(screen.getByText(/Fertigstellen|Finish/));
    });

    expect(onCloseCalls).toBe(1);
  });

  it('shows step indicator', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    // The step indicator shows "1 / 4" inside .wizard-steps
    const stepsEl = document.querySelector('.wizard-steps');
    expect(stepsEl).toBeDefined();
    expect(stepsEl!.textContent).toContain('1');
    expect(stepsEl!.textContent).toContain('4');
  });
});
