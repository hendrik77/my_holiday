import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { ViewType } from '../types';
import { downloadCSV, parseImportCSV } from '../utils/export';
import { SettingsModal } from './SettingsModal';
import { useT } from '../i18n/useT';

const views: { key: ViewType; labelKey: string }[] = [
  { key: 'dashboard', labelKey: 'nav.overview' },
  { key: 'year', labelKey: 'nav.yearView' },
  { key: 'month', labelKey: 'nav.monthView' },
  { key: 'list', labelKey: 'nav.list' },
];

export function Nav() {
  const { view, year, setView, setYear, setSelectedMonth, periods, totalDays, state, importData } =
    useStore();
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleExport = () => {
    downloadCSV(periods, year, state, t);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

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
          importData(totalDays, result.periods);
          setImportError(null);
        }
      }

      if (result.errors.length > 0) {
        setImportError(result.errors.join('\n'));
      } else {
        setImportError(null);
      }
    };
    reader.onerror = () => {
      setImportError(t('nav.importErrorRead'));
    };
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
          <button
            className="nav-year-btn"
            onClick={() => {
              const newYear = year - 1;
              setYear(newYear);
              setSelectedMonth(0);
            }}
            title={t('nav.prevYear')}
          >
            ‹
          </button>
          <span className="nav-year-label">{year}</span>
          <button
            className="nav-year-btn"
            onClick={() => {
              const newYear = year + 1;
              setYear(newYear);
              setSelectedMonth(0);
            }}
            title={t('nav.nextYear')}
          >
            ›
          </button>
        </div>

        <div className="nav-io">
          <button
            className="nav-io-btn"
            onClick={() => setShowSettings(true)}
            title={t('nav.settings')}
          >
            ⚙️
          </button>
          <button
            className="nav-io-btn"
            onClick={handleImport}
            title={t('nav.importTitle')}
          >
            {t('nav.import')}
          </button>
          <button
            className="nav-io-btn"
            onClick={handleExport}
            title={t('nav.exportTitle')}
          >
            {t('nav.export')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
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
