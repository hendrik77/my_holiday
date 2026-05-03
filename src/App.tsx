import { useEffect, useState } from 'react';

import { Nav } from './components/Nav';
import { Dashboard } from './components/Dashboard';
import { YearView } from './components/YearView';
import { MonthView } from './components/MonthView';
import { ListView } from './components/ListView';
import { ToastContainer } from './components/Toast';
import { FirstRunWizard } from './components/FirstRunWizard';
import { useUIStore } from './state/store';
import { useSettings } from './api/hooks';
import './App.css';

function App() {
  const view = useUIStore((s) => s.view);
  const storeTheme = useUIStore((s) => s.theme);
  const { data: settings } = useSettings();
  const theme = settings?.theme || storeTheme;
  const employmentStartDate = settings?.employmentStartDate;
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const showWizard = !!settings && !employmentStartDate && !wizardDismissed;

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => {
        root.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
      };
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <div className="app">
      <Nav />
      <main className="main">
        {view === 'dashboard' && <Dashboard />}
        {view === 'year' && <YearView />}
        {view === 'month' && <MonthView />}
        {view === 'list' && <ListView />}
      </main>
      <ToastContainer />
      {showWizard && <FirstRunWizard onClose={() => setWizardDismissed(true)} />}
    </div>
  );
}

export default App;
