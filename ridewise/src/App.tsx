import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useStore } from './store/store';
import Dashboard from './pages/Dashboard';

// Map-heavy pages load on demand to keep first paint fast on mid-range phones.
const PlanWizard = lazy(() => import('./pages/PlanWizard'));
const MapPage = lazy(() => import('./pages/MapPage'));
const Schedule = lazy(() => import('./pages/Schedule'));
const Live = lazy(() => import('./pages/Live'));
const Checklists = lazy(() => import('./pages/Checklists'));
const History = lazy(() => import('./pages/History'));
const Settings = lazy(() => import('./pages/Settings'));
const SharedPlan = lazy(() => import('./pages/SharedPlan'));

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  return (
    <HashRouter>
      <Layout>
        {!hydrated ? (
          <p role="status">Loading your saved rides…</p>
        ) : (
          <Suspense fallback={<p role="status">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/plan" element={<PlanWizard />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/ride" element={<Live />} />
              <Route path="/checklists" element={<Checklists />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/share/:token" element={<SharedPlan />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </Suspense>
        )}
      </Layout>
    </HashRouter>
  );
}
