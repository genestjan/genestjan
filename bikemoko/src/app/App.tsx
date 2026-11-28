import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './session';
import { Shell, Splash } from './Shell';
import { Toaster } from '@/ui/kit';
import { seedIfEmpty } from '@/data/seed';
import { cloudConfigured, startSync } from '@/data/sync';

// Each module owns its folder in src/screens/<module>/.
const Dashboard = lazy(() => import('@/screens/dashboard'));
const POS = lazy(() => import('@/screens/pos'));
const Repairs = lazy(() => import('@/screens/repairs'));
const EstimateBuilder = lazy(() => import('@/screens/repairs/EstimateBuilder'));
const JobDetail = lazy(() => import('@/screens/repairs/JobDetail'));
const Calendar = lazy(() => import('@/screens/calendar'));
const MyJobs = lazy(() => import('@/screens/myjobs'));
const Inventory = lazy(() => import('@/screens/inventory'));
const Scan = lazy(() => import('@/screens/scan'));
const Transfers = lazy(() => import('@/screens/transfers'));
const Purchasing = lazy(() => import('@/screens/purchasing'));
const Suppliers = lazy(() => import('@/screens/suppliers'));
const Customers = lazy(() => import('@/screens/customers'));
const Reports = lazy(() => import('@/screens/reports'));
const Settings = lazy(() => import('@/screens/settings'));

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // With the cloud set up, a blank device stays empty until the owner signs in and data is pulled.
    // Demo data is only for local-only builds.
    (cloudConfigured() ? Promise.resolve(false) : seedIfEmpty()).finally(() => {
      setReady(true);
      // Does nothing until the Supabase URL and key are set for the build.
      startSync();
    });
  }, []);
  if (!ready) return <Splash />;
  return (
    <SessionProvider>
      {/* Hash routing works on GitHub Pages, inside the Android app and the Windows app. */}
      <HashRouter>
        <Shell>
          <Suspense fallback={<div className="h-40" />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/repairs" element={<Repairs />} />
              <Route path="/repairs/estimate/:id" element={<EstimateBuilder />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/my-jobs" element={<MyJobs />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/purchasing" element={<Purchasing />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </Suspense>
        </Shell>
        <Toaster />
      </HashRouter>
    </SessionProvider>
  );
}
