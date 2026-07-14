import { useEffect, useState } from 'react';

import { Nav } from './components/Nav';
import { Dashboard } from './components/Dashboard';
import { YearView } from './components/YearView';
import { MonthView } from './components/MonthView';
import { ListView } from './components/ListView';
import { TeamView } from './components/TeamView';
import { ToastContainer } from './components/Toast';
import { FirstRunWizard } from './components/FirstRunWizard';
import { AuthGate } from './auth/AuthGate';
import { useUIStore } from './state/store';
import { useSettings } from './api/hooks';
import './App.css';

function App() {
  const view = useUIStore((s) => s.view);
  const theme = useUIStore((s) => s.theme);
  const { data: settings } = useSettings();
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
      <AuthGate>
        <Nav />
        <main className="main">
          {view === 'dashboard' && <Dashboard />}
          {view === 'year' && <YearView />}
          {view === 'month' && <MonthView />}
          {view === 'list' && <ListView />}
          {view === 'team' && <TeamView />}
        </main>
        {showWizard && <FirstRunWizard onClose={() => setWizardDismissed(true)} />}
      </AuthGate>
      {/* Outside the gate so the session-expired toast is visible on the login page. */}
      <ToastContainer />
    </div>
  );
}

export default App;
