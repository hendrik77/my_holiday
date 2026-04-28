import { useMemo } from 'react';
import { useStore } from '../state/store';
import {
  MONTH_NAMES,
  getFirstDayOfMonth,
  getDaysInMonth,
  isWorkDay,
  isPublicHoliday,
  isSpecialHalfDay,
  toISODate,
  parseISODate,
} from '../utils/calendar';

export function YearView() {
  const { year, periods, state, setView, setSelectedMonth } = useStore();

  // Build a set of vacation day ISO strings
  const vacationDays = useMemo(() => {
    const set = new Set<string>();
    for (const p of periods) {
      const start = parseISODate(p.startDate);
      const end = parseISODate(p.endDate);
      const current = new Date(start);
      while (current <= end) {
        set.add(toISODate(current));
        current.setDate(current.getDate() + 1);
      }
    }
    return set;
  }, [periods]);

  const todayStr = toISODate(new Date());

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>Jahresansicht {year}</h2>
      <div className="year-grid">
        {MONTH_NAMES.map((monthName, monthIdx) => {
          const days = getDaysInMonth(year, monthIdx);
          const firstDay = getFirstDayOfMonth(year, monthIdx);
          // Monday-first: shift Sunday (0) to end
          const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;

          // Build grid cells
          const cells: (Date | null)[] = [];
          for (let i = 0; i < firstDayAdjusted; i++) {
            cells.push(null); // padding
          }
          for (const d of days) {
            cells.push(d);
          }
          // Pad to complete rows
          while (cells.length % 7 !== 0) {
            cells.push(null);
          }

          // Count vacation work days this month
          let vacayCount = 0;
          for (const d of days) {
            const iso = toISODate(d);
            if (vacationDays.has(iso) && isWorkDay(d, state)) {
              // Check if this day belongs to a half-day period
              const period = periods.find((p) => {
                return iso >= p.startDate && iso <= p.endDate;
              });
              if (period?.halfDay || isSpecialHalfDay(d)) {
                vacayCount += 0.5;
              } else {
                vacayCount++;
              }
            }
          }

          return (
            <div
              key={monthIdx}
              className="month-card"
              onClick={() => {
                setSelectedMonth(monthIdx);
                setView('month');
              }}
            >
              <div className="month-card-header">
                {monthName}{' '}
                {vacayCount > 0 && `(${vacayCount % 1 === 0 ? vacayCount : vacayCount.toFixed(1).replace('.', ',')})`}
              </div>
              <div className="month-card-grid">
                {/* Day headers — Mon–Sun */}
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                  <div key={d} className="month-card-day-header">
                    {d}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (!d) {
                    return <div key={`pad-${i}`} className="month-card-day other-month" />;
                  }
                  const iso = toISODate(d);
                  const isVacation = vacationDays.has(iso);
                  const isHoliday = isPublicHoliday(d, state);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = iso === todayStr;

                  let cls = 'month-card-day';
                  if (isVacation) {
                    const period = periods.find((p) => iso >= p.startDate && iso <= p.endDate);
                    cls += (period?.halfDay || isSpecialHalfDay(d)) ? ' vacation-half' : ' vacation';
                  } else if (isHoliday) cls += ' holiday';
                  else if (isWeekend) cls += ' weekend';

                  return (
                    <div key={iso} className={cls}>
                      {d.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
