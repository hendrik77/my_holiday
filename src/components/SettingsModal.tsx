import { useState } from 'react';
import { useUIStore } from '../state/store';
import { useSettings, useUpdateSettings } from '../api/hooks';
import { GERMAN_STATES } from '../data/holidays';
import type { GermanState } from '../data/holidays';
import { useT } from '../i18n/useT';
import './Modal.css';
import type { Language } from '../i18n/translations';

interface SettingsModalProps { onClose: () => void; }

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { theme, language, setTheme, setLanguage } = useUIStore();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const { t } = useT();

  const [days, setDays] = useState(String(settings?.totalDays ?? 30));
  const [carryOver, setCarryOver] = useState(String(settings?.carryOverDays ?? 0));
  const [selectedState, setSelectedState] = useState<GermanState>((settings?.state as GermanState) || 'HE');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'auto'>(theme);
  const [error, setError] = useState<string | null>(null);
  const [carryOverError, setCarryOverError] = useState<string | null>(null);

  const handleSave = () => {
    const num = parseInt(days, 10);
    if (isNaN(num) || num < 1 || num > 60) { setError(t('settings.daysError')); return; }
    const co = parseInt(carryOver, 10);
    if (isNaN(co) || co < 0 || co > 60) { setCarryOverError(t('settings.carryOverError')); return; }

    updateSettings.mutate({ totalDays: num, carryOverDays: co, state: selectedState });
    setLanguage(selectedLanguage);
    setTheme(selectedTheme);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{t('settings.title')}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('settings.daysPerYear')}</label>
            <input type="number" className="form-input" min={1} max={60} value={days} onChange={(e) => { setDays(e.target.value); setError(null); }} />
            {error && <div className="form-hint" style={{ color: 'var(--color-primary)' }}>{error}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.carryOver')}</label>
            <input type="number" className="form-input" min={0} max={60} value={carryOver} onChange={(e) => { setCarryOver(e.target.value); setCarryOverError(null); }} />
            <div className="form-hint">{t('settings.carryOverHint')}</div>
            {carryOverError && <div className="form-hint" style={{ color: 'var(--color-primary)' }}>{carryOverError}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.state')}</label>
            <select className="form-input" value={selectedState} onChange={(e) => setSelectedState(e.target.value as GermanState)}>
              {GERMAN_STATES.map((s) => (<option key={s.code} value={s.code}>{t(`states.${s.code}`)}</option>))}
            </select>
            <div className="form-hint">{t('settings.stateHint')}</div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.theme')}</label>
            <select className="form-input" value={selectedTheme} onChange={(e) => setSelectedTheme(e.target.value as 'light' | 'dark' | 'auto')}>
              <option value="light">{t('settings.themeLight')}</option>
              <option value="dark">{t('settings.themeDark')}</option>
              <option value="auto">{t('settings.themeAuto')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.language')}</label>
            <select className="form-input" value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value as Language)}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('settings.cancel')}</button>
          <button className="btn btn-primary" onClick={handleSave}>{t('settings.save')}</button>
        </div>
      </div>
    </div>
  );
}
