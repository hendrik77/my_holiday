import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { ViewType } from '../types';
import { downloadCSV, parseImportCSV } from '../utils/export';

const views: { key: ViewType; label: string }[] = [
  { key: 'dashboard', label: 'Übersicht' },
  { key: 'year', label: 'Jahresansicht' },
  { key: 'month', label: 'Monatsansicht' },
  { key: 'list', label: 'Liste' },
];

export function Nav() {
  const { view, year, setView, setYear, setSelectedMonth, periods, totalDays, importData } =
    useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = () => {
    downloadCSV(periods, totalDays, year);
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
      const result = parseImportCSV(text);

      if (result.periods.length > 0) {
        const confirmed = window.confirm(
          `${result.periods.length} Urlaubseinträge importieren?\n\nBestehende Einträge werden dabei ersetzt.`
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
      setImportError('Fehler beim Lesen der Datei.');
    };
    reader.readAsText(file, 'UTF-8');

    // Reset input so the same file can be re-imported
    e.target.value = '';
  };

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-brand">
          <span className="nav-brand-dot" />
          My Holiday
        </div>

        <div className="nav-links">
          {views.map((v) => (
            <button
              key={v.key}
              className={`nav-link ${view === v.key ? 'active' : ''}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
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
            title="Vorheriges Jahr"
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
            title="Nächstes Jahr"
          >
            ›
          </button>
        </div>

        <div className="nav-io">
          <button
            className="nav-io-btn"
            onClick={handleImport}
            title="Urlaubsdaten aus CSV importieren"
          >
            📥 Import
          </button>
          <button
            className="nav-io-btn"
            onClick={handleExport}
            title="Urlaubsdaten als CSV exportieren"
          >
            📤 Export
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
    </nav>
  );
}
