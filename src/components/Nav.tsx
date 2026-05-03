import { useRef, useState } from 'react';
import { useUIStore } from '../state/store';
import type { ViewType } from '../types';
import { downloadCSV, parseImportCSV } from '../utils/export';
import { generateICS } from '../utils/ics';
import { usePeriods, useCreatePeriod, useSettings } from '../api/hooks';
import { SettingsModal } from './SettingsModal';
import { useT } from '../i18n/useT';

const views: { key: ViewType; labelKey: string }[] = [
  { key: 'dashboard', labelKey: 'nav.overview' },
  { key: 'year', labelKey: 'nav.yearView' },
  { key: 'month', labelKey: 'nav.monthView' },
  { key: 'list', labelKey: 'nav.list' },
];

export function Nav() {
  const { view, year, setView, setYear, setSelectedMonth } = useUIStore();
  const { data: periods = [] } = usePeriods(year);
  const { data: settings } = useSettings();
  const createPeriod = useCreatePeriod();
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleExport = () => {
    const state = (settings?.state as 'HE') || 'HE';
    downloadCSV(periods, year, state, t);
  };

  const handleExportIcs = () => {
    const ics = generateICS(periods, year);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    a.download = `urlaub-${year}_${ts}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => { fileInputRef.current?.click(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const result = parseImportCSV(text, t);

      if (result.periods.length > 0) {
        const confirmed = window.confirm(
          t('nav.importConfirm', { count: result.periods.length })
        );
        if (confirmed) {
          for (const p of result.periods) {
            createPeriod.mutate(p);
          }
          setImportError(null);
        }
      }

      if (result.errors.length > 0) {
        setImportError(result.errors.join('\n'));
      } else {
        setImportError(null);
      }
    };
    reader.onerror = () => { setImportError(t('nav.importErrorRead')); };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand">
          <span className="nav-brand-dot" />
          {t('app.title')}
        </div>

        <div className="nav-links">
          {views.map((v) => (
            <button
              key={v.key}
              className={`nav-link ${view === v.key ? 'active' : ''}`}
              onClick={() => setView(v.key)}
            >
              {t(v.labelKey)}
            </button>
          ))}
        </div>

        <div className="nav-year">
          <button className="nav-year-btn" onClick={() => { setYear(year - 1); setSelectedMonth(0); }} title={t('nav.prevYear')}>‹</button>
          <span className="nav-year-label">{year}</span>
          <button className="nav-year-btn" onClick={() => { setYear(year + 1); setSelectedMonth(0); }} title={t('nav.nextYear')}>›</button>
        </div>

        <div className="nav-io">
          <button className="nav-io-btn" onClick={() => setShowSettings(true)} title={t('nav.settings')}>⚙️</button>
          <button className="nav-io-btn" onClick={handleImport} title={t('nav.importTitle')}>{t('nav.import')}</button>
          <button className="nav-io-btn" onClick={handleExport} title={t('nav.exportTitle')}>{t('nav.export')}</button>
          <button className="nav-io-btn" onClick={handleExportIcs} title={t('nav.exportIcsTitle')}>{t('nav.exportIcs')}</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      </div>

      {importError && (
        <div className="nav-error">
          <span>{importError}</span>
          <button onClick={() => setImportError(null)}>✕</button>
        </div>
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </nav>
  );
}
