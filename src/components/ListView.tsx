import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import {
  countVacationWorkDays,
  parseISODate,
  formatDateRange,
} from '../utils/calendar';
import type { VacationPeriod } from '../types';
import { VacationModal } from './VacationModal';

export function ListView() {
  const { periods, year, totalDays, removePeriod } = useStore();
  const [editingPeriod, setEditingPeriod] = useState<VacationPeriod | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Filter periods that overlap with the current year
  const yearPeriods = useMemo(() => {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return periods
      .filter((p) => p.endDate >= yearStart && p.startDate <= yearEnd)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [periods, year]);

  const totalUsed = useMemo(() => {
    return yearPeriods.reduce((sum, p) => {
      return sum + countVacationWorkDays(p);
    }, 0);
  }, [yearPeriods]);

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>Urlaubsliste {year}</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Urlaub planen
        </button>
      </div>

      {yearPeriods.length === 0 ? (
        <div className="empty-state">
          <h3>Keine Urlaube für {year}</h3>
          <p>Plane deine Urlaubstage, um sie hier zu sehen.</p>
        </div>
      ) : (
        <>
          <table className="list-table">
            <thead>
              <tr>
                <th>Zeitraum</th>
                <th>Arbeitstage</th>
                <th>Notiz</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {yearPeriods.map((p) => {
                const days = countVacationWorkDays(p);
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
                        {days === 0.5 ? 'Tage' : days === 1 ? 'Tag' : 'Tage'}
                      </span>
                    </td>
                    <td>
                      <span className="list-note">
                        {p.note || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="list-actions">
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => setEditingPeriod(p)}
                          title="Bearbeiten"
                        >
                          ✎
                        </button>
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => removePeriod(p.id)}
                          title="Löschen"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 500 }}>Gesamt</td>
                <td>
                  <strong>{totalUsed}</strong>{' '}
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                    von {totalDays} Tagen
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
                      ? `${totalUsed - totalDays} Tage über Limit`
                      : `${totalDays - totalUsed} Tage übrig`}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}

      {editingPeriod && (
        <VacationModal
          initial={editingPeriod}
          onClose={() => setEditingPeriod(null)}
        />
      )}
      {showAdd && (
        <VacationModal onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}
