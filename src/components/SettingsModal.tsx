import { useState } from 'react';
import { useStore } from '../state/store';
import { GERMAN_STATES } from '../data/holidays';
import type { GermanState } from '../data/holidays';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { totalDays, state, setTotalDays, setState } = useStore();
  const [days, setDays] = useState(String(totalDays));
  const [selectedState, setSelectedState] = useState<GermanState>(state);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const num = parseInt(days, 10);
    if (isNaN(num) || num < 1 || num > 60) {
      setError('Bitte eine Zahl zwischen 1 und 60 eingeben.');
      return;
    }
    setTotalDays(num);
    setState(selectedState);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>Einstellungen</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Urlaubstage pro Jahr</label>
            <input
              type="number"
              className="form-input"
              min={1}
              max={60}
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setError(null);
              }}
            />
            {error && <div className="form-hint" style={{ color: 'var(--color-primary)' }}>{error}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Bundesland</label>
            <select
              className="form-input"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value as GermanState)}
            >
              {GERMAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="form-hint">
              Bestimmt die gesetzlichen Feiertage für deine Region.
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
