import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { FirstRunWizard } from '../FirstRunWizard';

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
  });

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
    const nextBtn = screen.getByText(/Weiter|Next/);
    fireEvent.click(nextBtn);
    // Should now be on step 2 (Bundesland) — check the step indicator shows 2
    const stepsEl = document.querySelector('.wizard-steps');
    expect(stepsEl!.textContent).toContain('2');
  });

  it('has a Back button on step 2', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    // Advance to step 2
    fireEvent.click(screen.getByText(/Weiter|Next/));
    const backBtn = screen.getByText(/Zurück|Back/);
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn);
    // Back to step 1
    expect(screen.getByText(/Beschäftigt seit|Employed since/)).toBeDefined();
  });

  it('shows Finish button on last step', () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    // Step 1 → 2
    fireEvent.click(screen.getByText(/Weiter|Next/));
    // Step 2 → 3 (vacation days)
    fireEvent.click(screen.getByText(/Weiter|Next/));
    // Step 3 → 4 (carry-over policy)
    fireEvent.click(screen.getByText(/Weiter|Next/));

    expect(screen.getByText(/Fertigstellen|Finish/)).toBeDefined();
  });

  it('calls onClose when Finish is clicked', async () => {
    renderWizard({ onClose: () => { onCloseCalls++; } });
    // Navigate to step 4
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
