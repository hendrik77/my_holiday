import { useState } from 'react';
import { useTokens, useCreateToken, useRevokeToken } from '../api/hooks';
import { useT } from '../i18n/useT';
import type { PatScope } from '../../server/types';

/**
 * Token self-service inside the settings modal (oidc mode only): list,
 * create (the raw value is shown exactly once), and revoke. The CLI uses
 * these tokens via MY_HOLIDAY_API_TOKEN — no CLI changes needed.
 */
export function ApiTokensSection() {
  const { t } = useT();
  const { data: tokens = [] } = useTokens();
  const createToken = useCreateToken();
  const revokeToken = useRevokeToken();

  const [name, setName] = useState('');
  const [scope, setScope] = useState<PatScope>('full');
  const [newToken, setNewToken] = useState<string | null>(null);

  const active = tokens.filter((tok) => tok.revokedAt === null);

  const handleCreate = () => {
    if (!name.trim()) return;
    createToken.mutate(
      { name: name.trim(), scope },
      {
        onSuccess: (res) => {
          setNewToken(res.token);
          setName('');
        },
      },
    );
  };

  const handleRevoke = (id: string) => {
    if (window.confirm(t('tokens.revokeConfirm'))) revokeToken.mutate(id);
  };

  return (
    <div className="form-group">
      <label className="form-label">{t('tokens.title')}</label>

      {active.length === 0 && !newToken && <div className="form-hint">{t('tokens.empty')}</div>}

      {active.map((tok) => (
        <div key={tok.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 4 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tok.name}</span>
          <code style={{ fontSize: '0.8rem' }}>{tok.tokenPrefix}…</code>
          <span className="form-hint" style={{ margin: 0 }}>
            {tok.scope === 'read' ? t('tokens.scopeRead') : t('tokens.scopeFull')}
          </span>
          <button className="btn btn-secondary" onClick={() => handleRevoke(tok.id)}>
            {t('tokens.revoke')}
          </button>
        </div>
      ))}

      {newToken && (
        <div className="form-hint" style={{ wordBreak: 'break-all' }}>
          <strong>{t('tokens.createdHint')}</strong>
          <br />
          <code>{newToken}</code>{' '}
          <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(newToken)}>
            {t('tokens.copy')}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap', marginTop: 8 }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: 1, minWidth: '10rem' }}
          placeholder={t('tokens.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select className="form-input" style={{ width: 'auto' }} value={scope} onChange={(e) => setScope(e.target.value as PatScope)}>
          <option value="full">{t('tokens.scopeFull')}</option>
          <option value="read">{t('tokens.scopeRead')}</option>
        </select>
        <button className="btn btn-secondary" onClick={handleCreate} disabled={createToken.isPending || !name.trim()}>
          {t('tokens.create')}
        </button>
      </div>
    </div>
  );
}
