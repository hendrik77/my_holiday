import { useMemo, useState } from 'react';
import { useUIStore } from '../state/store';
import { usePeriods, useSettings, useDeletePeriod } from '../api/hooks';
import { countVacationWorkDaysInYear, formatDateRange } from '../utils/calendar';
import { computeProRataEntitlement, computeLeaveReduction } from '../utils/entitlement';
import type { VacationPeriod } from '../types';
import { VacationModal } from './VacationModal';
import { showToast } from './toastStore';
import { useT } from '../i18n/useT';
import { generateICS, downloadSingleICS } from '../utils/ics';
import './ListView.css';
import './TypeBadges.css';

export function ListView() {
  const year = useUIStore((s) => s.year);
  const { data: periods = [] } = usePeriods(year);
  const { data: settings } = useSettings();
  const baseTotalDays = settings?.totalDays ?? 30;
  const state = (settings?.state as 'HE') || 'HE';
  const deletePeriod = useDeletePeriod();
  const { t } = useT();
  const [editingPeriod, setEditingPeriod] = useState<VacationPeriod | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const effectiveTotalDays = useMemo(() => {
    const proRata = computeProRataEntitlement(
      settings?.employmentStartDate ?? '',
      settings?.employmentEndDate ?? '',
      year,
      baseTotalDays,
    );
    const reduction = computeLeaveReduction(periods, year, baseTotalDays);
    return Math.max(0, proRata - reduction);
  }, [settings, year, periods, baseTotalDays]);

  const yearPeriods = useMemo(() => {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return periods.filter((p) => p.endDate >= yearStart && p.startDate <= yearEnd).sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [periods, year]);

  const totalUsed = useMemo(() => {
    return yearPeriods
      .filter((p) => !p.type || p.type === 'urlaub')
      .reduce((sum, p) => sum + countVacationWorkDaysInYear(p, year, state), 0);
  }, [yearPeriods, year, state]);

  const formatDays = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ',');

  const handleRemove = (p: VacationPeriod) => {
    deletePeriod.mutate(p.id);
    showToast(t('toast.deleted'));
  };

  const handleExportIcs = () => {
    const ics = generateICS(yearPeriods, year);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `urlaub-${year}_${ts}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="list-view">
      <div className="list-header">
        <h2>{t('listView.title', { year })}</h2>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          {yearPeriods.length > 0 && (
            <button className="btn btn-secondary" onClick={handleExportIcs} title={t('listView.exportIcsTitle')}>
              {t('listView.exportIcs')}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{t('listView.addVacation')}</button>
        </div>
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
                const typeLabel = p.type && p.type !== 'urlaub' ? t(`vacationTypes.${p.type}`) : null;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {formatDateRange(p.startDate, p.endDate)}{p.halfDay && ' (½)'}
                      {typeLabel && <span className={`type-badge type-badge--${p.type}`}>{typeLabel}</span>}
                    </td>
                    <td><strong>{daysLabel}</strong> <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{t(days === 1 ? 'dashboard.days_one' : 'dashboard.days_other', { count: days })}</span></td>
                    <td><span className="list-note">{p.note || '—'}</span></td>
                    <td>
                      <div className="list-actions">
                        <button className="btn-ghost btn-sm" title={t('listView.downloadIcs')} onClick={() => downloadSingleICS(p)}>📅</button>
                        <button className="btn-ghost btn-sm" onClick={() => setEditingPeriod(p)}>✎</button>
                        <button className="btn-danger btn-sm" onClick={() => handleRemove(p)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 500 }}>{t('listView.totalVacation')}</td>
                <td><strong>{formatDays(totalUsed)}</strong> <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{t('listView.ofDays', { total: formatDays(effectiveTotalDays) })}</span></td>
                <td colSpan={2}><span style={{ color: totalUsed > effectiveTotalDays ? 'var(--color-primary)' : 'var(--color-success)', fontSize: 13 }}>{totalUsed > effectiveTotalDays ? t('listView.over', { over: formatDays(totalUsed - effectiveTotalDays) }) : t('listView.remaining', { remaining: formatDays(effectiveTotalDays - totalUsed) })}</span></td>
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
