import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/context';
import { ApiTokensSection } from '../ApiTokensSection';

const mockUseTokens = vi.fn();
const mockCreate = vi.fn();
const mockRevoke = vi.fn();

vi.mock('../../api/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/hooks')>()),
  useTokens: () => mockUseTokens(),
  useCreateToken: () => ({ mutate: mockCreate, isPending: false }),
  useRevokeToken: () => ({ mutate: mockRevoke, isPending: false }),
}));

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <ApiTokensSection />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ApiTokensSection', () => {
  it('lists active tokens with prefix and scope', () => {
    mockUseTokens.mockReturnValue({
      data: [
        { id: 't1', name: 'CLI on laptop', tokenPrefix: 'mh_pat_abcd1', scope: 'full', expiresAt: null, lastUsedAt: null, createdAt: '2026-07-13T10:00:00.000Z', revokedAt: null },
        { id: 't2', name: 'old one', tokenPrefix: 'mh_pat_zzzz9', scope: 'read', expiresAt: null, lastUsedAt: null, createdAt: '2026-07-01T10:00:00.000Z', revokedAt: '2026-07-02T10:00:00.000Z' },
      ],
    });
    renderSection();
    expect(screen.getByText('CLI on laptop')).toBeDefined();
    expect(screen.getByText(/mh_pat_abcd1/)).toBeDefined();
    // Revoked tokens are not listed.
    expect(screen.queryByText('old one')).toBeNull();
  });

  it('creates a token and shows the raw value once', () => {
    mockUseTokens.mockReturnValue({ data: [] });
    mockCreate.mockImplementation((_input: unknown, opts?: { onSuccess?: (res: { token: string }) => void }) =>
      opts?.onSuccess?.({ token: 'mh_pat_NEWTOKEN' }),
    );
    renderSection();

    fireEvent.change(screen.getByPlaceholderText('CLI auf dem Laptop'), { target: { value: 'Mein CLI' } });
    fireEvent.click(screen.getByText('Token erstellen'));

    expect(mockCreate).toHaveBeenCalledWith(
      { name: 'Mein CLI', scope: 'full' },
      expect.anything(),
    );
    expect(screen.getByText('mh_pat_NEWTOKEN')).toBeDefined();
  });

  it('revokes a token after confirmation', () => {
    mockUseTokens.mockReturnValue({
      data: [
        { id: 't1', name: 'CLI', tokenPrefix: 'mh_pat_abcd1', scope: 'full', expiresAt: null, lastUsedAt: null, createdAt: '2026-07-13T10:00:00.000Z', revokedAt: null },
      ],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderSection();

    fireEvent.click(screen.getByText('Widerrufen'));
    expect(mockRevoke).toHaveBeenCalledWith('t1');
  });
});
