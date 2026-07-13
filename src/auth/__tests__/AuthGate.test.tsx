import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { AuthGate } from '../AuthGate';

const mockUseCurrentUser = vi.fn();

vi.mock('../../api/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/hooks')>()),
  useCurrentUser: () => mockUseCurrentUser(),
}));

function renderGate() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <AuthGate>
          <div>APP CONTENT</div>
        </AuthGate>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthGate', () => {
  it('renders neither content nor login while the session is being checked', () => {
    mockUseCurrentUser.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderGate();
    expect(screen.queryByText('APP CONTENT')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Anmelden' })).toBeNull();
  });

  it('renders children in single-user mode', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { id: 'u1', name: 'Local user', email: 'local@my-holiday.invalid', team: '', role: 'admin', authMode: 'none' },
      isLoading: false,
      error: null,
    });
    renderGate();
    expect(screen.getByText('APP CONTENT')).toBeDefined();
  });

  it('renders children for an authenticated oidc user', () => {
    mockUseCurrentUser.mockReturnValue({
      data: { id: 'u2', name: 'Carol', email: 'carol@example.com', team: '', role: 'employee', authMode: 'oidc' },
      isLoading: false,
      error: null,
    });
    renderGate();
    expect(screen.getByText('APP CONTENT')).toBeDefined();
  });

  it('shows the login page with a sign-in link when unauthenticated', () => {
    mockUseCurrentUser.mockReturnValue({ data: undefined, isLoading: false, error: new Error('Authentication required') });
    renderGate();
    expect(screen.queryByText('APP CONTENT')).toBeNull();
    const signIn = screen.getByRole('link', { name: 'Anmelden' });
    expect(signIn.getAttribute('href')).toContain('/auth/login');
  });
});
