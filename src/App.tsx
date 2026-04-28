import { useEffect } from 'react';
import { Nav } from './components/Nav';
import { Dashboard } from './components/Dashboard';
import { YearView } from './components/YearView';
import { MonthView } from './components/MonthView';
import { ListView } from './components/ListView';
import { useStore } from './state/store';
import './App.css';

function App() {
  const view = useStore((s) => s.view);
  const theme = useStore((s) => s.theme);

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
    </div>
  );
}

export default App;
