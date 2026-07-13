import { loginUrl } from '../api/client';
import { useT } from '../i18n/useT';
import './auth.css';

/** Shown by the AuthGate when oidc mode has no valid session. */
export function LoginPage() {
  const { t } = useT();
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="nav-brand-dot" />
          <h1>{t('app.title')}</h1>
        </div>
        <p className="login-hint">{t('auth.signInHint')}</p>
        <a className="login-button" href={loginUrl()}>
          {t('auth.signIn')}
        </a>
      </div>
    </div>
  );
}
