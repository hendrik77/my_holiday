import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { countVacationWorkDays, parseISODate, formatDateRange } from '../utils/calendar';
import { VacationModal } from './VacationModal';

export function Dashboard() {
  const { periods, totalDays, year, setView } = useStore();
  const [showAdd, setShowAdd] = useState(false);

  const usedDays = useMemo(() => {
    return periods.reduce((sum, p) => {
      return sum + countVacationWorkDays(p);
    }, 0);
  }, [periods]);

  const remainingDays = totalDays - usedDays;
  const usedPercent = Math.min((usedDays / totalDays) * 100, 100);
  const isOver = usedDays > totalDays;

  // Upcoming vacations (not yet ended, sorted by start date)
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

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Übersicht {year}</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Urlaub planen
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className={`stat-card used`}>
          <div className="stat-label">Genutzt</div>
          <div className={`stat-value ${isOver ? 'over' : ''}`}>
            {usedDays % 1 === 0 ? usedDays : usedDays.toFixed(1).replace('.', ',')}
          </div>
          <div className="stat-sub">Tage</div>
        </div>
        <div className={`stat-card remaining`}>
          <div className="stat-label">Verbleibend</div>
          <div className="stat-value">{Math.max(0, remainingDays)}</div>
          <div className="stat-sub">Tage</div>
        </div>
        <div className="stat-card total">
          <div className="stat-label">Gesamt</div>
          <div className="stat-value">{totalDays}</div>
          <div className="stat-sub">Urlaubstage</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${isOver ? 'over' : ''}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        <div className="progress-labels">
          <span>{usedDays % 1 === 0 ? usedDays : usedDays.toFixed(1).replace('.', ',')} genutzt</span>
          <span>{Math.max(0, remainingDays)} übrig</span>
        </div>
      </div>

      {/* Upcoming */}
      <div>
        <h3 className="upcoming-title">Anstehende Urlaube</h3>
        {upcoming.length === 0 ? (
          <div className="empty-state">
            <h3>Noch kein Urlaub geplant</h3>
            <p>Plane deine Urlaubstage für {year}.</p>
          </div>
        ) : (
          <div className="upcoming-list">
            {upcoming.map((p) => {
              const days = countVacationWorkDays(p);
              const daysLabel = days === 0.5 ? '0,5 Tage' : `${days} ${days === 1 ? 'Tag' : 'Tage'}`;
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
                  <div className="upcoming-days">
                    {daysLabel}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <VacationModal
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
