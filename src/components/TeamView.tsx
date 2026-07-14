import { useMemo } from 'react';
import { useUIStore } from '../state/store';
import { useTeamPeriods, useSettings } from '../api/hooks';
import { getDaysInMonth, isWorkDay, toISODate } from '../utils/calendar';
import { useT } from '../i18n/useT';
import type { GermanState } from '../data/holidays';
import type { PeriodRow } from '../../server/types';
import './Calendar.css';

/** Set of ISO dates covered by any of the given periods. */
function vacationDateSet(periods: PeriodRow[]): Set<string> {
  const set = new Set<string>();
  for (const p of periods) {
    const current = new Date(p.startDate);
    const end = new Date(p.endDate);
    while (current <= end) {
      set.add(toISODate(current));
      current.setDate(current.getDate() + 1);
    }
  }
  return set;
}

function MemberRow({ name, team, periods, year, state }: {
  name: string;
  team: string;
  periods: PeriodRow[];
  year: number;
  state: GermanState;
}) {
  const { t, tRaw } = useT();
  const monthNames = tRaw<string[]>('monthView.months');
  const vacationDays = useMemo(() => vacationDateSet(periods), [periods]);

  const used = useMemo(() => {
    let count = 0;
    for (let m = 0; m < 12; m++) {
      for (const d of getDaysInMonth(year, m)) {
        if (vacationDays.has(toISODate(d)) && isWorkDay(d, state)) count++;
      }
    }
    return count;
  }, [vacationDays, year, state]);

  return (
    <div className="team-row">
      <div className="team-row-head">
        <span className="team-row-name">{name}</span>
        {team && <span className="team-row-team">{team}</span>}
        <span className="team-row-used">{t('team.daysUsed', { count: used })}</span>
      </div>
      <div className="team-months">
        {monthNames.map((monthName, m) => {
          const days = getDaysInMonth(year, m);
          return (
            <div key={m} className="team-month" title={monthName}>
              <div className="team-month-label">{monthName.slice(0, 3)}</div>
              <div className="team-month-days">
                {days.map((d) => {
                  const iso = toISODate(d);
                  const isVacation = vacationDays.has(iso);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  let cls = 'team-day';
                  if (isVacation) cls += ' vacation';
                  else if (isWeekend) cls += ' weekend';
                  return <span key={iso} className={cls} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Read-only manager/admin overlay (Phase 7): one row per team member with a
 * compact 12-month strip of their booked days. Notes are governed
 * server-side by the org privacyLevel; this view only renders dates.
 */
export function TeamView() {
  const { year } = useUIStore();
  const { data: team = [], isLoading } = useTeamPeriods(year);
  const { data: settings } = useSettings();
  const state = (settings?.state as GermanState) || 'HE';
  const { t } = useT();

  if (isLoading) return null;

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--space-lg)' }}>{t('nav.team')} {year}</h2>
      {team.length === 0 ? (
        <p className="form-hint">{t('team.empty')}</p>
      ) : (
        <div className="team-grid">
          {team.map((member) => (
            <MemberRow
              key={member.user.id}
              name={member.user.name}
              team={member.user.team}
              periods={member.periods}
              year={year}
              state={state}
            />
          ))}
        </div>
      )}
    </div>
  );
}
