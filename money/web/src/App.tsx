import { useEffect } from 'react';
import { AccountSheet, BillSheet, BudgetSheet, PaySheet, TxnSheet } from './components/forms';
import { ImportSheet } from './components/importer';
import { Shell } from './components/Shell';
import { BusyOverlay, Logo, Toast } from './components/ui';
import { native } from './lib/native';
import { boot, useApp } from './lib/session';
import { Accounts } from './pages/Accounts';
import { Analytics } from './pages/Analytics';
import { CloudSetup, ConfirmEmail, CreateAccount, Forgot, Locked, RecoveryKey, SignIn, Welcome } from './pages/Auth';
import { Budgets } from './pages/Budgets';
import { Debts } from './pages/Debts';
import { Home } from './pages/Home';
import { Inbox, More } from './pages/Inbox';
import { SettingsPage } from './pages/Settings';
import { Transactions } from './pages/Transactions';
import { navigate, useRoute } from './router';
import { closeTopSheet } from './ui-state';

declare global { interface Window { __mhBack?: () => boolean } }

function Page() {
  switch (useRoute()) {
    case '/tx': return <Transactions />;
    case '/accounts': return <Accounts />;
    case '/budgets': return <Budgets />;
    case '/debts': return <Debts />;
    case '/analytics': return <Analytics />;
    case '/inbox': return <Inbox />;
    case '/settings': return <SettingsPage />;
    case '/more': return <More />;
    default: return <Home />;
  }
}

function DemoBanner() {
  return (
    <div className="flex items-center justify-center gap-3 bg-signal px-4 py-1.5 text-center text-[13px] font-medium text-ink" style={{ paddingTop: 'calc(0.375rem + var(--safe-top))' }}>
      Sample data. Nothing here is real.
      <button className="underline" onClick={() => { location.hash = ''; location.reload(); }}>Start for real</button>
    </div>
  );
}

export function App() {
  const phase = useApp((s) => s.phase);
  const demo = useApp((s) => s.demo);
  const blockScreenshots = useApp((s) => s.phase === 'ready' && !!s.snap?.settings.blockScreenshots);

  // Sign-in screens hold no money data, so they can always be screenshotted.
  useEffect(() => { void native.screenSecure(blockScreenshots).catch(() => undefined); }, [blockScreenshots]);

  useEffect(() => {
    void boot({ demo: /demo/.test(location.hash) || new URLSearchParams(location.search).has('demo') });
    // The Android back button: close a form, then go back to Home, then leave the app.
    window.__mhBack = () => {
      if (window.__mhSheetBack) { window.__mhSheetBack(); return true; }
      if (closeTopSheet()) return true;
      if (useApp.getState().phase === 'ready' && location.hash && location.hash !== '#/') { navigate('/'); return true; }
      return false;
    };
  }, []);

  if (phase === 'boot') {
    return <div className="grid h-full place-items-center bg-ink"><Logo size={72} glow /></div>;
  }

  const auth = {
    welcome: <Welcome />, cloud: <CloudSetup />, create: <CreateAccount />, signin: <SignIn />, 'confirm-email': <ConfirmEmail />,
    recovery: <RecoveryKey />, locked: <Locked />, forgot: <Forgot />,
  } as const;

  if (phase !== 'ready') return <>{auth[phase]}<BusyOverlay /></>;

  return (
    <div className="flex h-full flex-col">
      {demo && <DemoBanner />}
      <div className="min-h-0 flex-1">
        <Shell><Page /></Shell>
      </div>
      <TxnSheet />
      <AccountSheet />
      <BillSheet />
      <PaySheet />
      <BudgetSheet />
      <ImportSheet />
      <Toast />
      <BusyOverlay />
    </div>
  );
}
