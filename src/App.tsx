import { Nav } from './components/Nav';
import { Dashboard } from './components/Dashboard';
import { YearView } from './components/YearView';
import { MonthView } from './components/MonthView';
import { ListView } from './components/ListView';
import { useStore } from './state/store';
import './App.css';

function App() {
  const view = useStore((s) => s.view);

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
