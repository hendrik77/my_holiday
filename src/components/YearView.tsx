import { useMemo } from 'react';
import { useStore } from '../state/store';
import {
  getFirstDayOfMonth,
  getDaysInMonth,
  isWorkDay,
  isPublicHoliday,
  isSpecialHalfDay,
  toISODate,
} from '../utils/calendar';
import { useT } from '../i18n/context';

export function YearView() {
  const { year, periods, state, setView, setSelectedMonth } = useStore();
  const { t } = useT();
  const months = t('monthView.months') as unknown as string[];
  const weekdays = t('monthView.weekdays') as unknown as string[];

  const vacationDays = useMemo(() => {
    const set = new Set<string>();
    for (const p of periods) {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
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
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>{t('nav.yearView')} {year}</h2>
      <div className="year-grid">
        {months.map((monthName, monthIdx) => {
          const days = getDaysInMonth(year, monthIdx);
          const firstDay = getFirstDayOfMonth(year, monthIdx);
          const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;

          const cells: (Date | null)[] = [];
          for (let i = 0; i < firstDayAdjusted; i++) cells.push(null);
          for (const d of days) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);

          let vacayCount = 0;
          for (const d of days) {
            const iso = toISODate(d);
            if (vacationDays.has(iso) && isWorkDay(d, state)) {
              const period = periods.find((p) => iso >= p.startDate && iso <= p.endDate);
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
              onClick={() => { setSelectedMonth(monthIdx); setView('month'); }}
            >
              <div className="month-card-header">
                {monthName}{' '}
                {vacayCount > 0 && `(${vacayCount % 1 === 0 ? vacayCount : vacayCount.toFixed(1).replace('.', ',')})`}
              </div>
              <div className="month-card-grid">
                {weekdays.slice(0, 7).map((d) => (
                  <div key={d} className="month-card-day-header">{d}</div>
                ))}
                {cells.map((d, i) => {
                  if (!d) return <div key={`pad-${i}`} className="month-card-day other-month" />;
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

                  return <div key={iso} className={cls}>{d.getDate()}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
