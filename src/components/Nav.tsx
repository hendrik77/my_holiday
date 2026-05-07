import { useState } from 'react';
import './Nav.css';
import { useUIStore } from '../state/store';
import type { ViewType } from '../types';
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
  const { t } = useT();
  const [showSettings, setShowSettings] = useState(false);

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
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </nav>
  );
}
