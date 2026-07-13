import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { Nav } from '../Nav';

const mockUseCurrentUser = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../api/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/hooks')>()),
  useCurrentUser: () => mockUseCurrentUser(),
  useLogout: () => ({ mutate: mockLogout, isPending: false }),
}));

function renderNav() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <Nav />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Nav account section', () => {
  it('shows nothing account-related in single-user mode', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { id: 'u1', name: 'Local user', email: 'local@my-holiday.invalid', team: '', role: 'admin', authMode: 'none' },
    });
    renderNav();
    expect(screen.queryByTitle('Abmelden')).toBeNull();
    expect(screen.queryByText('Local user')).toBeNull();
  });

  it('shows the user name and a working logout button in oidc mode', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { id: 'u2', name: 'Carol', email: 'carol@example.com', team: '', role: 'employee', authMode: 'oidc' },
    });
    renderNav();
    expect(screen.getByText('Carol')).toBeDefined();
    fireEvent.click(screen.getByTitle('Abmelden'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
