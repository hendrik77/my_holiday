import { useMemo, useState, useCallback } from 'react';
import { useStore } from '../state/store';
import {
  getFirstDayOfMonth,
  getDaysInMonth,
  isPublicHoliday,
  getHolidayName,
  toISODate,
  parseISODate,
  countWorkDays,
  countVacationWorkDaysInYear,
} from '../utils/calendar';
import { isSchoolHoliday } from '../data/schoolHolidays';
import type { VacationPeriod } from '../types';
import { VacationModal } from './VacationModal';
import { showToast } from './Toast';
import { useT } from '../i18n/context';

export function MonthView() {
  const {
    year, selectedMonth, periods, state,
    setSelectedMonth, setView, setYear, removePeriod,
  } = useStore();
  const { t } = useT();

  const [selectStart, setSelectStart] = useState<string | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<VacationPeriod | null>(null);

  const months = t('monthView.months') as unknown as string[];
  const weekdays = t('monthView.weekdays') as unknown as string[];

  const todayStr = toISODate(new Date());
  const days = useMemo(() => getDaysInMonth(year, selectedMonth), [year, selectedMonth]);
  const firstDay = getFirstDayOfMonth(year, selectedMonth);
  const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;

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
    if (selectedMonth === 0) { setYear(year - 1); setSelectedMonth(11); }
    else { setSelectedMonth(selectedMonth - 1); }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) { setYear(year + 1); setSelectedMonth(0); }
    else { setSelectedMonth(selectedMonth + 1); }
  };

  const handleDayClick = useCallback(
    (iso: string) => {
      const existing = dayToPeriod.get(iso);
      if (existing && !selectStart) { setEditingPeriod(existing); return; }

      if (!selectStart) {
        setSelectStart(iso);
      } else {
        const start = parseISODate(selectStart);
        const end = parseISODate(iso);
        const rangeStart = start <= end ? selectStart : iso;
        const rangeEnd = start <= end ? iso : selectStart;
        setSelectStart(null);
        setEditingPeriod({ id: '', startDate: rangeStart, endDate: rangeEnd, note: '' });
      }
    },
    [selectStart, dayToPeriod]
  );

  // Build grid cells
  const cells: { date: Date | null; iso: string | null }[] = [];
  const prevMonthDays = firstDayAdjusted;
  const prevMonthLastDay = new Date(year, selectedMonth, 0).getDate();
  for (let i = prevMonthDays - 1; i >= 0; i--) {
    const d = new Date(year, selectedMonth - 1, prevMonthLastDay - i);
    cells.push({ date: d, iso: toISODate(d) });
  }
  for (const d of days) { cells.push({ date: d, iso: toISODate(d) }); }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, selectedMonth + 1, i);
      cells.push({ date: d, iso: toISODate(d) });
    }
  }

  const selectionRange = useMemo(() => {
    if (!selectStart) return new Set<string>();
    return new Set([selectStart]);
  }, [selectStart]);

  const selectedDaysInfo = useMemo(() => {
    if (!selectStart) return null;
    const days = countWorkDays(parseISODate(selectStart), parseISODate(selectStart), state);
    return t(days === 1 ? 'monthView.workday_one' : 'monthView.workday_other', { count: days });
  }, [selectStart, state, t]);

  return (
    <div className="month-view">
      <div className="month-view-header">
        <div className="month-view-nav">
          <button onClick={goToPrevMonth} title={t('nav.prevYear')}>‹</button>
          <h2 className="month-view-month">{months[selectedMonth]} {year}</h2>
          <button onClick={goToNextMonth} title={t('nav.nextYear')}>›</button>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setView('year')}>
          {t('monthView.yearView')}
        </button>
      </div>

      {selectStart && (
        <div className="selection-hint">
          <span>
            {t('monthView.selectionHint', {
              start: new Date(selectStart).toLocaleDateString('de-DE'),
              days: selectedDaysInfo || '',
            })}
          </span>
          <button onClick={() => setSelectStart(null)}>{t('monthView.cancel')}</button>
        </div>
      )}

      <div className="month-grid">
        {weekdays.map((d) => (
          <div key={d} className="month-grid-weekday">{d}</div>
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

          const prevDay = new Date(d); prevDay.setDate(prevDay.getDate() - 1);
          const prevPeriod = dayToPeriod.get(toISODate(prevDay));
          const isVacationStart = isVacation && (!prevPeriod || prevPeriod.id !== period.id);

          let cls = 'month-grid-day';
          if (!isCurrentMonth) cls += ' other-month';
          else if (isSelected) cls += ' selected';
          else if (isWeekend) cls += ' weekend';
          if (isHoliday && isCurrentMonth) cls += ' holiday';
          if (isSchoolHoliday(d, state) && isCurrentMonth) cls += ' school-holiday';
          if (isToday && isCurrentMonth) cls += ' today';

          return (
            <div key={iso} className={cls} onClick={() => isCurrentMonth && handleDayClick(iso)}>
              <div className="month-grid-day-number">{d.getDate()}</div>
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

      {/* School holiday legend */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 'var(--space-xs)' }}>
        ⚜ = Schulferien
      </div>

      {periods.filter((p) => {
        const start = parseISODate(p.startDate);
        const end = parseISODate(p.endDate);
        return (
          (start.getFullYear() === year && start.getMonth() === selectedMonth) ||
          (end.getFullYear() === year && end.getMonth() === selectedMonth) ||
          (start <= new Date(year, selectedMonth + 1, 0) && end >= new Date(year, selectedMonth, 1))
        );
      }).length > 0 && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <h4 style={{ marginBottom: 'var(--space-sm)' }}>{t('monthView.vacationsThisMonth')}</h4>
          <div className="upcoming-list">
            {periods.filter((p) => {
              const start = parseISODate(p.startDate);
              const end = parseISODate(p.endDate);
              const monthStart = new Date(year, selectedMonth, 1);
              const monthEnd = new Date(year, selectedMonth + 1, 0);
              return start <= monthEnd && end >= monthStart;
            }).map((p) => {
              const days = countVacationWorkDaysInYear(p, year, state);
              const daysLabel = days === 0.5
                ? '0,5 Arbeitstage'
                : `${days} ${days === 1 ? t('monthView.workday_one') : t('monthView.workday_other')}`;
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
                    <span className="upcoming-days">{daysLabel}</span>
                    <div className="list-actions">
                      <button className="btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditingPeriod(p); }}>✎</button>
                      <button className="btn-danger btn-sm" onClick={(e) => {
                        e.stopPropagation();
                        removePeriod(p.id);
                        showToast(t('toast.deleted'), () => {
                          useStore.getState().undo();
                        });
                      }}>✕</button>
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
