import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { countVacationWorkDaysInYear, formatDateRange } from '../utils/calendar';
import type { VacationPeriod } from '../types';
import { VacationModal } from './VacationModal';
import { showToast } from './Toast';
import { useT } from '../i18n/context';

export function ListView() {
  const { periods, year, totalDays, state, removePeriod } = useStore();
  const { t } = useT();
  const [editingPeriod, setEditingPeriod] = useState<VacationPeriod | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const yearPeriods = useMemo(() => {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return periods
      .filter((p) => p.endDate >= yearStart && p.startDate <= yearEnd)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [periods, year]);

  const totalUsed = useMemo(() => {
    return yearPeriods.reduce((sum, p) => {
      return sum + countVacationWorkDaysInYear(p, year, state);
    }, 0);
  }, [yearPeriods, year, state]);

  const handleRemove = (p: VacationPeriod) => {
    removePeriod(p.id);
    showToast(t('toast.deleted'), () => {
      useStore.getState().undo();
    });
  };

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>{t('listView.title', { year })}</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          {t('listView.addVacation')}
        </button>
      </div>

      {yearPeriods.length === 0 ? (
        <div className="empty-state">
          <h3>{t('listView.noVacation', { year })}</h3>
          <p>{t('listView.noVacationHint')}</p>
        </div>
      ) : (
        <>
          <table className="list-table">
            <thead>
              <tr>
                <th>{t('listView.period')}</th>
                <th>{t('listView.workdays')}</th>
                <th>{t('listView.note')}</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {yearPeriods.map((p) => {
                const days = countVacationWorkDaysInYear(p, year, state);
                const daysLabel = days === 0.5 ? '0,5' : String(days);
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {formatDateRange(p.startDate, p.endDate)}
                      {p.halfDay && ' (½)'}
                    </td>
                    <td>
                      <strong>{daysLabel}</strong>{' '}
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                        {days === 0.5 ? t('dashboard.days_half') : t(days === 1 ? 'dashboard.days_one' : 'dashboard.days_other', { count: days })}
                      </span>
                    </td>
                    <td>
                      <span className="list-note">{p.note || '—'}</span>
                    </td>
                    <td>
                      <div className="list-actions">
                        <button className="btn-ghost btn-sm" onClick={() => setEditingPeriod(p)} title={t('vacationModal.edit')}>✎</button>
                        <button className="btn-danger btn-sm" onClick={() => handleRemove(p)} title={t('toast.deleted')}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 500 }}>{t('listView.total')}</td>
                <td>
                  <strong>{totalUsed % 1 === 0 ? totalUsed : totalUsed.toFixed(1).replace('.', ',')}</strong>{' '}
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                    {t('listView.ofDays', { total: totalDays })}
                  </span>
                </td>
                <td colSpan={2}>
                  <span
                    style={{
                      color: totalUsed > totalDays ? 'var(--color-primary)' : 'var(--color-success)',
                      fontSize: 13,
                    }}
                  >
                    {totalUsed > totalDays
                      ? t('listView.over', { over: totalUsed - totalDays })
                      : t('listView.remaining', { remaining: totalDays - totalUsed })}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      {editingPeriod && <VacationModal initial={editingPeriod} onClose={() => setEditingPeriod(null)} />}
      {showAdd && <VacationModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
