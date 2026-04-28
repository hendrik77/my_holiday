import { useMemo, useState, useCallback } from 'react';
import { useStore } from '../state/store';
import {
  MONTH_NAMES,
  getFirstDayOfMonth,
  getDaysInMonth,
  isPublicHoliday,
  getHolidayName,
  toISODate,
  parseISODate,
  countWorkDays,
  countVacationWorkDays,
} from '../utils/calendar';
import type { VacationPeriod } from '../types';
import { VacationModal } from './VacationModal';

export function MonthView() {
  const {
    year,
    selectedMonth,
    periods,
    state,
    setSelectedMonth,
    setView,
    setYear,
    removePeriod,
  } = useStore();

  const [selectStart, setSelectStart] = useState<string | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<VacationPeriod | null>(null);

  const todayStr = toISODate(new Date());
  const days = useMemo(() => getDaysInMonth(year, selectedMonth), [year, selectedMonth]);
  const firstDay = getFirstDayOfMonth(year, selectedMonth);
  // Monday-first
  const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;

  // Map ISO date -> period that covers this day
  const dayToPeriod = useMemo(() => {
    const map = new Map<string, VacationPeriod>();
    for (const p of periods) {
      const start = parseISODate(p.startDate);
      const end = parseISODate(p.endDate);
      const current = new Date(start);
      while (current <= end) {
        map.set(toISODate(current), p);
        current.setDate(current.getDate() + 1);
      }
    }
    return map;
  }, [periods]);

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setYear(year - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setYear(year + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleDayClick = useCallback(
    (iso: string) => {
      // If clicking on an existing vacation, open edit
      const existing = dayToPeriod.get(iso);
      if (existing && !selectStart) {
        setEditingPeriod(existing);
        return;
      }

      if (!selectStart) {
        // Start selection
        setSelectStart(iso);
      } else {
        // End selection
        const start = parseISODate(selectStart);
        const end = parseISODate(iso);
        // Ensure start <= end
        const rangeStart = start <= end ? selectStart : iso;
        const rangeEnd = start <= end ? iso : selectStart;
        setSelectStart(null);
        setEditingPeriod({
          id: '',
          startDate: rangeStart,
          endDate: rangeEnd,
          note: '',
        });
      }
    },
    [selectStart, dayToPeriod]
  );

  // Build grid cells
  const cells: { date: Date | null; iso: string | null }[] = [];
  // Previous month padding
  const prevMonthDays = firstDayAdjusted;
  const prevMonthLastDay = new Date(year, selectedMonth, 0).getDate();
  for (let i = prevMonthDays - 1; i >= 0; i--) {
    const d = new Date(year, selectedMonth - 1, prevMonthLastDay - i);
    cells.push({ date: d, iso: toISODate(d) });
  }

  for (const d of days) {
    cells.push({ date: d, iso: toISODate(d) });
  }

  // Next month padding
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, selectedMonth + 1, i);
      cells.push({ date: d, iso: toISODate(d) });
    }
  }

  // Compute selection range
  const selectionRange = useMemo(() => {
    if (!selectStart) return new Set<string>();
    const set = new Set<string>();
    set.add(selectStart);
    return set;
  }, [selectStart]);

  const selectedDaysInfo = useMemo(() => {
    if (!selectStart) return null;
    // Count work days if selection ends at the start
    const days = countWorkDays(parseISODate(selectStart), parseISODate(selectStart), state);
    return `${days} Arbeitstag${days !== 1 ? 'e' : ''}`;
  }, [selectStart, state]);

  return (
    <div className="month-view">
      <div className="month-view-header">
        <div className="month-view-nav">
          <button onClick={goToPrevMonth} title="Vorheriger Monat">
            ‹
          </button>
          <h2 className="month-view-month">
            {MONTH_NAMES[selectedMonth]} {year}
          </h2>
          <button onClick={goToNextMonth} title="Nächster Monat">
            ›
          </button>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setView('year')}
        >
          Jahresansicht
        </button>
      </div>

      {selectStart && (
        <div className="selection-hint">
          <span>
            Start: <strong>{new Date(selectStart).toLocaleDateString('de-DE')}</strong>
            {' — '}
            Klicke auf ein Enddatum, um den Urlaub festzulegen.
            {selectedDaysInfo && ` (${selectedDaysInfo})`}
          </span>
          <button onClick={() => setSelectStart(null)}>Abbrechen</button>
        </div>
      )}

      <div className="month-grid">
        {/* Weekday headers — Mon–Sun */}
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
          <div key={d} className="month-grid-weekday">
            {d}
          </div>
        ))}

        {cells.map((cell, idx) => {
          if (!cell.date || !cell.iso) {
            return <div key={`empty-${idx}`} className="month-grid-day other-month" />;
          }

          const d = cell.date;
          const iso = cell.iso;
          const isCurrentMonth = d.getMonth() === selectedMonth;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const isHoliday = isPublicHoliday(d, state);
          const holidayName = getHolidayName(d, state);
          const isToday = iso === todayStr;
          const isSelected = selectionRange.has(iso);
          const period = dayToPeriod.get(iso);
          const isVacation = !!period;

          // Determine if this is the first or continuing day of a vacation
          const prevDay = new Date(d);
          prevDay.setDate(prevDay.getDate() - 1);
          const prevPeriod = dayToPeriod.get(toISODate(prevDay));
          const isVacationStart = isVacation && (!prevPeriod || prevPeriod.id !== period.id);

          let cls = 'month-grid-day';
          if (!isCurrentMonth) cls += ' other-month';
          else if (isSelected) cls += ' selected';
          else if (isWeekend) cls += ' weekend';
          if (isHoliday && isCurrentMonth) cls += ' holiday';
          if (isToday && isCurrentMonth) cls += ' today';

          return (
            <div
              key={iso}
              className={cls}
              onClick={() => isCurrentMonth && handleDayClick(iso)}
            >
              <div className="month-grid-day-number">
                {d.getDate()}
              </div>
              {isHoliday && isCurrentMonth && holidayName && (
                <div className="holiday-label">{holidayName}</div>
              )}
              {isVacation && isCurrentMonth && isVacationStart && (
                <div className="vacation-indicator" title={period.note || 'Urlaub'}>
                  {period.halfDay ? '½ ' : ''}{period.note || 'Urlaub'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {periods.filter((p) => {
        const start = parseISODate(p.startDate);
        const end = parseISODate(p.endDate);
        return (
          (start.getFullYear() === year && start.getMonth() === selectedMonth) ||
          (end.getFullYear() === year && end.getMonth() === selectedMonth) ||
          (start <= new Date(year, selectedMonth + 1, 0) &&
            end >= new Date(year, selectedMonth, 1))
        );
      }).length > 0 && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <h4 style={{ marginBottom: 'var(--space-sm)' }}>
            Urlaube in diesem Monat
          </h4>
          <div className="upcoming-list">
            {periods
              .filter((p) => {
                const start = parseISODate(p.startDate);
                const end = parseISODate(p.endDate);
                const monthStart = new Date(year, selectedMonth, 1);
                const monthEnd = new Date(year, selectedMonth + 1, 0);
                return start <= monthEnd && end >= monthStart;
              })
              .map((p) => {
                const days = countVacationWorkDays(p, state);
                const daysLabel = days === 0.5 ? '0,5 Arbeitstage' : `${days} ${days === 1 ? 'Arbeitstag' : 'Arbeitstage'}`;
                return (
                  <div key={p.id} className="upcoming-item">
                    <div>
                      <div className="upcoming-range">
                        {new Date(p.startDate).toLocaleDateString('de-DE')}
                        {' – '}
                        {new Date(p.endDate).toLocaleDateString('de-DE')}
                        {p.halfDay && ' (½)'}
                      </div>
                      {p.note && (
                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                          {p.note}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                      <span className="upcoming-days">
                        {daysLabel}
                      </span>
                      <div className="list-actions">
                        <button
                          className="btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPeriod(p);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          className="btn-danger btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePeriod(p.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {editingPeriod && (
        <VacationModal
          initial={editingPeriod.id ? editingPeriod : undefined}
          onClose={() => setEditingPeriod(null)}
          presetDates={
            !editingPeriod.id && editingPeriod.startDate && editingPeriod.endDate
              ? { startDate: editingPeriod.startDate, endDate: editingPeriod.endDate }
              : undefined
          }
        />
      )}
    </div>
  );
}
