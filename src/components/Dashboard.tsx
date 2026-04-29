import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { countVacationWorkDaysInYear, parseISODate, formatDateRange } from '../utils/calendar';
import { VacationModal } from './VacationModal';
import { useT } from '../i18n/context';

export function Dashboard() {
  const { periods, totalDays, year, state } = useStore();
  const { t } = useT();
  const [showAdd, setShowAdd] = useState(false);

  const usedDays = useMemo(() => {
    return periods.reduce((sum, p) => {
      return sum + countVacationWorkDaysInYear(p, year, state);
    }, 0);
  }, [periods, year, state]);

  const remainingDays = totalDays - usedDays;
  const usedPercent = Math.min((usedDays / totalDays) * 100, 100);
  const isOver = usedDays > totalDays;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = useMemo(() => {
    return periods
      .filter((p) => {
        const end = parseISODate(p.endDate);
        end.setHours(23, 59, 59, 999);
        return end >= today;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [periods, today.toISOString()]);

  const formatUsed = usedDays % 1 === 0 ? usedDays : usedDays.toFixed(1).replace('.', ',');

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{t('dashboard.title', { year })}</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          {t('dashboard.addVacation')}
        </button>
      </div>

      <div className="stats-grid">
        <div className={`stat-card used`}>
          <div className="stat-label">{t('dashboard.used')}</div>
          <div className={`stat-value ${isOver ? 'over' : ''}`}>{formatUsed}</div>
          <div className="stat-sub">{t('dashboard.days')}</div>
        </div>
        <div className={`stat-card remaining`}>
          <div className="stat-label">{t('dashboard.remaining')}</div>
          <div className="stat-value">{Math.max(0, remainingDays)}</div>
          <div className="stat-sub">{t('dashboard.days')}</div>
        </div>
        <div className="stat-card total">
          <div className="stat-label">{t('dashboard.total')}</div>
          <div className="stat-value">{totalDays}</div>
          <div className="stat-sub">{t('dashboard.vacationDays')}</div>
        </div>
      </div>

      <div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${isOver ? 'over' : ''}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <div className="progress-labels">
          <span>{t('dashboard.usedLabel', { used: formatUsed })}</span>
          <span>{t('dashboard.remainingLabel', { remaining: Math.max(0, remainingDays) })}</span>
        </div>
      </div>

      <div>
        <h3 className="upcoming-title">{t('dashboard.upcoming')}</h3>
        {upcoming.length === 0 ? (
          <div className="empty-state">
            <h3>{t('dashboard.noVacation')}</h3>
            <p>{t('dashboard.planHint', { year })}</p>
          </div>
        ) : (
          <div className="upcoming-list">
            {upcoming.map((p) => {
              const days = countVacationWorkDaysInYear(p, year, state);
              const daysLabel =
                days === 0.5
                  ? t('dashboard.days_half')
                  : t(days === 1 ? 'dashboard.days_one' : 'dashboard.days_other', { count: days });
              return (
                <div key={p.id} className="upcoming-item">
                  <div>
                    <div className="upcoming-range">
                      {formatDateRange(p.startDate, p.endDate)}
                      {p.halfDay && ' (½)'}
                    </div>
                    {p.note && (
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {p.note}
                      </div>
                    )}
                  </div>
                  <div className="upcoming-days">{daysLabel}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && <VacationModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
