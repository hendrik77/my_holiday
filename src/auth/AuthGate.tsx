import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '../api/hooks';
import { LoginPage } from './LoginPage';
import { showToast } from '../components/toastStore';
import { useT } from '../i18n/useT';

/**
 * Session boundary for the whole app: children render only once the acting
 * user is known (single-user mode included — /auth/me answers in both
 * modes). An `auth:expired` event from the API client drops all cached
 * state, which lands the user back here on the login page.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const qc = useQueryClient();
  const { t } = useT();

  useEffect(() => {
    const onExpired = () => {
      // Only a *lost* session gets the toast — the initial unauthenticated
      // load fires the same event but has no user data yet.
      if (qc.getQueryData(['auth', 'me'])) {
        showToast(t('auth.sessionExpired'));
        qc.clear();
      }
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [qc, t]);

  // Nothing while /auth/me resolves: in single-user mode this is a single
  // fast local round-trip, and a flashing "checking session" message would
  // be a visible regression there (review H3).
  if (isLoading) return null;
  if (!user) return <LoginPage />;
  return <>{children}</>;
}
