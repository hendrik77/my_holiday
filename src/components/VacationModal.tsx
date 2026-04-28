import { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import type { VacationPeriod } from '../types';
import { countVacationWorkDays } from '../utils/calendar';

interface VacationModalProps {
  onClose: () => void;
  initial?: VacationPeriod;
  presetDates?: { startDate: string; endDate: string };
}

export function VacationModal({ onClose, initial, presetDates }: VacationModalProps) {
  const { addPeriod, updatePeriod, year, state } = useStore();
  const isEditing = !!initial?.id;

  const [startDate, setStartDate] = useState(
    initial?.startDate || presetDates?.startDate || `${year}-01-01`
  );
  const [endDate, setEndDate] = useState(
    initial?.endDate || presetDates?.endDate || `${year}-01-05`
  );
  const [note, setNote] = useState(initial?.note || '');
  const [halfDay, setHalfDay] = useState(initial?.halfDay || false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const isSingleDay = startDate === endDate;

  const workDays = useMemo(() => {
    try {
      return countVacationWorkDays({ startDate, endDate, halfDay }, state);
    } catch {
      return 0;
    }
  }, [startDate, endDate, halfDay]);

  // Ensure endDate >= startDate
  useEffect(() => {
    if (endDate < startDate) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  // Auto-collapse to single day when half-day is toggled on
  useEffect(() => {
    if (halfDay && startDate !== endDate) {
      setEndDate(startDate);
    }
  }, [halfDay, startDate, endDate]);

  const handleSave = () => {
    if (isEditing && initial) {
      updatePeriod(initial.id, { startDate, endDate, note, halfDay });
    } else {
      addPeriod({ startDate, endDate, note, halfDay });
    }
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <h3>{isEditing ? 'Urlaub bearbeiten' : 'Neuer Urlaub'}</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Startdatum</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Enddatum</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notiz (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="z.B. Sommerurlaub, Ski-Urlaub..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <label className={`form-checkbox ${!isSingleDay ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={halfDay}
              onChange={(e) => setHalfDay(e.target.checked)}
              disabled={!isSingleDay && !halfDay}
            />
            <span>Halber Tag (½ Arbeitstag)</span>
          </label>
          {!isSingleDay && (
            <div className="form-hint" style={{ marginTop: -8 }}>
              Ein halber Tag kann nur für einzelne Tage gebucht werden.
            </div>
          )}

          <div className="form-hint">
            <strong>{workDays === 0.5 ? '0,5' : workDays}</strong>{' '}
            {workDays === 1 ? 'Arbeitstag' : workDays === 0.5 ? 'Arbeitstage' : 'Arbeitstage'}
            {' '}(WE, Feiertage nicht gezählt; 24.12. & 31.12. zählen als ½ Tag)
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {isEditing ? 'Speichern' : 'Urlaub planen'}
          </button>
        </div>
      </div>
    </div>
  );
}
