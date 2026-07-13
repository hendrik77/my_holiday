import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { TeamView } from '../TeamView';

const mockUseTeamPeriods = vi.fn();

vi.mock('../../api/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/hooks')>()),
  useTeamPeriods: () => mockUseTeamPeriods(),
  useSettings: () => ({ data: { state: 'HE' } }),
}));

function renderTeam() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <TeamView />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TeamView', () => {
  it('renders a row per team member with their name', () => {
    mockUseTeamPeriods.mockReturnValue({
      data: [
        { user: { id: 'r1', name: 'Alice', team: 'Platform' }, periods: [{ id: 'p1', startDate: '2026-07-06', endDate: '2026-07-10', note: '', halfDay: false, type: 'urlaub', changedAt: '' }] },
        { user: { id: 'r2', name: 'Bob', team: '' }, periods: [] },
      ],
      isLoading: false,
    });
    renderTeam();
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('shows an empty-state message when there are no reports', () => {
    mockUseTeamPeriods.mockReturnValue({ data: [], isLoading: false });
    renderTeam();
    expect(screen.getByText(/Keine Teammitglieder|No team members/)).toBeDefined();
  });
});
