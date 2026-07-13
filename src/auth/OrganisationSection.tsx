import { useOrgSettings, useUpdateOrgSettings, useAdminUsers, useUpdateAdminUser } from '../api/hooks';
import { useT } from '../i18n/useT';
import type { PrivacyLevel, UserRole } from '../../server/types';

/**
 * Org administration inside the settings modal (admin only, oidc mode):
 * the org-wide privacy level plus a table to set each user's role, team,
 * and manager. Manager relationships are admin-managed in-app; IdP group
 * mapping is future work.
 */
export function OrganisationSection() {
  const { t } = useT();
  const { data: org } = useOrgSettings();
  const updateOrg = useUpdateOrgSettings();
  const { data: users = [] } = useAdminUsers();
  const updateUser = useUpdateAdminUser();

  const managerCandidates = users.filter((u) => u.role !== 'employee');

  return (
    <div className="form-group">
      <label className="form-label">{t('org.title')}</label>

      <label className="form-label" style={{ fontWeight: 400, marginTop: 8 }}>{t('org.privacyLabel')}</label>
      <select
        className="form-input"
        value={org?.privacyLevel ?? 'dates'}
        onChange={(e) => updateOrg.mutate(e.target.value as PrivacyLevel)}
      >
        <option value="nothing">{t('org.privacyNothing')}</option>
        <option value="dates">{t('org.privacyDates')}</option>
        <option value="dates_notes">{t('org.privacyDatesNotes')}</option>
      </select>
      <div className="form-hint">{t('org.privacyHint')}</div>

      <label className="form-label" style={{ marginTop: 12 }}>{t('org.usersTitle')}</label>
      {users.map((u) => (
        <div key={u.id} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: '8rem', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.email}>
            {u.name || u.email}
          </span>
          <select
            className="form-input"
            style={{ width: 'auto' }}
            value={u.role}
            onChange={(e) => updateUser.mutate({ id: u.id, updates: { role: e.target.value as UserRole } })}
          >
            <option value="employee">{t('org.roleEmployee')}</option>
            <option value="manager">{t('org.roleManager')}</option>
            <option value="admin">{t('org.roleAdmin')}</option>
          </select>
          <select
            className="form-input"
            style={{ width: 'auto' }}
            value={u.managerId ?? ''}
            onChange={(e) =>
              updateUser.mutate({ id: u.id, updates: { managerId: e.target.value === '' ? null : e.target.value } })
            }
          >
            <option value="">{t('org.noManager')}</option>
            {managerCandidates
              .filter((m) => m.id !== u.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.email}
                </option>
              ))}
          </select>
        </div>
      ))}
    </div>
  );
}
