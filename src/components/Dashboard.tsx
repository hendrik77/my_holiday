import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { countVacationWorkDaysInYear, countCarryOverUsed, carryOverDeadline, toISODate, formatDate, formatDateRange } from '../utils/calendar';
import { VacationModal } from './VacationModal';
import { useT } from '../i18n/useT';

const CARRY_OVER_WARNING_DAYS = 30;

export function Dashboard() {
  const { periods, totalDays, carryOverDays, year, state } = useStore();
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

  const todayISO = toISODate(new Date());

  const carryOverUsed = useMemo(() => {
    return countCarryOverUsed(periods, year, state, carryOverDays);
  }, [periods, year, state, carryOverDays]);

  const carryOverRemaining = carryOverDays - carryOverUsed;
  const deadline = carryOverDeadline(year);
  const isDeadlinePassed = todayISO > deadline;
  const daysToDeadline = Math.round(
    (new Date(deadline).getTime() - new Date(todayISO).getTime()) / (1000 * 60 * 60 * 24)
  );
  const carryOverWarn = carryOverRemaining > 0 && !isDeadlinePassed && daysToDeadline <= CARRY_OVER_WARNING_DAYS;
  const carryOverExpired = carryOverRemaining > 0 && isDeadlinePassed;
  const carryOverUsedPct = carryOverDays > 0 ? Math.min((carryOverUsed / carryOverDays) * 100, 100) : 0;

  const upcoming = useMemo(() => {
    const today = toISODate(new Date());
    return periods
      .filter((p) => p.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [periods]);

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

      {carryOverDays > 0 && (
        <div className="carry-over-card">
          <div className="carry-over-header">
            <span className="carry-over-label">{t('carryOver.label')}</span>
            <span className="carry-over-deadline">{t('carryOver.deadline', { date: formatDate(deadline) })}</span>
          </div>
          <div className="progress-bar carry-over-progress">
            <div
              className={`progress-fill ${carryOverExpired ? 'over' : ''}`}
              style={{ width: `${carryOverUsedPct}%` }}
            />
          </div>
          <div className="progress-labels">
            <span>{t('carryOver.used', { used: carryOverUsed, total: carryOverDays })}</span>
            <span>{t(carryOverRemaining === 1 ? 'carryOver.remaining' : 'carryOver.remaining_plural', { remaining: carryOverRemaining })}</span>
          </div>
          {(carryOverWarn || carryOverExpired) && (
            <div className={`carry-over-alert ${carryOverExpired ? 'expired' : 'warning'}`}>
              {carryOverExpired
                ? t('carryOver.expired', {
                    remaining: carryOverRemaining,
                    days_label: t(carryOverRemaining === 1 ? 'carryOver.days_one' : 'carryOver.days_other'),
                    date: formatDate(deadline),
                  })
                : t('carryOver.expiringSoon', {
                    remaining: carryOverRemaining,
                    days_label: t(carryOverRemaining === 1 ? 'carryOver.days_one' : 'carryOver.days_other'),
                    days: daysToDeadline,
                  })}
            </div>
          )}
        </div>
      )}

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
