import { useState, useMemo, useRef } from 'react';
import { useUIStore } from '../state/store';
import { usePeriods, useSettings, useCreatePeriod, useUpdatePeriod } from '../api/hooks';
import type { VacationPeriod, VacationType } from '../types';
import { countVacationWorkDays, hasOverlap } from '../utils/calendar';
import { useT } from '../i18n/useT';
import { downloadSingleICS } from '../utils/ics';
import './Modal.css';

const VACATION_TYPES: VacationType[] = [
  'urlaub', 'bildungsurlaub', 'kur', 'sabbatical',
  'unbezahlterUrlaub', 'mutterschaftsurlaub', 'elternzeit', 'sonderurlaub',
];

interface VacationModalProps {
  onClose: () => void;
  initial?: VacationPeriod;
  presetDates?: { startDate: string; endDate: string };
}

export function VacationModal({ onClose, initial, presetDates }: VacationModalProps) {
  const year = useUIStore((s) => s.year);
  const { data: periods = [] } = usePeriods(year);
  const { data: settings } = useSettings();
  const state = (settings?.state as 'HE') || 'HE';
  const createPeriod = useCreatePeriod();
  const updatePeriod = useUpdatePeriod();
  const { t } = useT();
  const isEditing = !!initial?.id;

  const [startDate, setStartDate] = useState(initial?.startDate || presetDates?.startDate || `${year}-01-01`);
  const [endDate, setEndDate] = useState(initial?.endDate || presetDates?.endDate || `${year}-01-05`);
  const [note, setNote] = useState(initial?.note || '');
  const [halfDay, setHalfDay] = useState(initial?.halfDay || false);
  const [type, setType] = useState<VacationType>(initial?.type || 'urlaub');
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isSingleDay = startDate === endDate;

  const workDays = useMemo(() => {
    try { return countVacationWorkDays({ startDate, endDate, halfDay }, state); }
    catch { return 0; }
  }, [startDate, endDate, halfDay, state]);

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (endDate < newStart || halfDay) setEndDate(newStart);
  };

  const handleHalfDayToggle = (checked: boolean) => {
    setHalfDay(checked);
    if (checked && startDate !== endDate) setEndDate(startDate);
  };

  const handleSave = () => {
    if (hasOverlap(startDate, endDate, periods, initial?.id)) {
      setError(t('vacationModal.overlapError'));
      return;
    }

    if (isEditing && initial) {
      updatePeriod.mutate({ id: initial.id, updates: { startDate, endDate, note, halfDay, type } });
    } else {
      createPeriod.mutate({ startDate, endDate, note, halfDay, type });
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const workDaysDisplay = workDays === 0.5 ? '0,5' : workDays;

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <h3>{isEditing ? t('vacationModal.edit') : t('vacationModal.new')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('vacationModal.startDate')}</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('vacationModal.endDate')}</label>
              <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('vacationModal.note')}</label>
            <input type="text" className="form-input" placeholder={t('vacationModal.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('vacationModal.type')}</label>
            <select className="form-input" value={type} onChange={(e) => setType(e.target.value as VacationType)}>
              {VACATION_TYPES.map((vt) => (
                <option key={vt} value={vt}>{t(`vacationTypes.${vt}`)}</option>
              ))}
            </select>
          </div>
          <label className={`form-checkbox ${!isSingleDay ? 'disabled' : ''}`}>
            <input type="checkbox" checked={halfDay} onChange={(e) => handleHalfDayToggle(e.target.checked)} disabled={!isSingleDay && !halfDay} />
            <span>{t('vacationModal.halfDay')}</span>
          </label>
          {!isSingleDay && <div className="form-hint" style={{ marginTop: -8 }}>{t('vacationModal.halfDayHint')}</div>}
          {error && <div className="form-error">{error}</div>}
          <div className="form-hint"><strong>{workDaysDisplay}</strong> {t('vacationModal.workdayHint')}</div>
        </div>
        <div className="modal-footer">
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {isEditing && initial && (
              <button className="btn btn-secondary" onClick={() => downloadSingleICS({ ...initial, startDate, endDate, note, halfDay, type })}>
                {t('vacationModal.downloadIcs')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-secondary" onClick={onClose}>{t('vacationModal.cancel')}</button>
            <button className="btn btn-primary" onClick={handleSave}>{isEditing ? t('vacationModal.save') : t('vacationModal.plan')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
