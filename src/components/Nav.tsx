import { useStore } from '../state/store';
import type { ViewType } from '../types';

const views: { key: ViewType; label: string }[] = [
  { key: 'dashboard', label: 'Übersicht' },
  { key: 'year', label: 'Jahresansicht' },
  { key: 'month', label: 'Monatsansicht' },
  { key: 'list', label: 'Liste' },
];

export function Nav() {
  const { view, year, setView, setYear, setSelectedMonth } = useStore();

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
      </div>
    </nav>
  );
}
