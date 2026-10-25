import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthGate, useAuthInit } from './components/auth/AuthGate';
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
const Help = lazy(() => import('./pages/Help'));

function Private() {
  return (
    <AuthGate>
      <Layout>
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
            <Route path="/help" element={<Help />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </Layout>
    </AuthGate>
  );
}

export default function App() {
  useAuthInit();
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* A shared plan can be read without an account. */}
        <Route
          path="/share/:token"
          element={
            <Suspense fallback={<p role="status" className="p-6">Opening shared plan…</p>}>
              <SharedPlan />
            </Suspense>
          }
        />
        <Route path="*" element={<Private />} />
      </Routes>
    </HashRouter>
  );
}
