import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CrashGuard } from './components/problems';
import { logProblem } from './lib/problems';
import './index.css';

declare global { const __APP_VERSION__: string }

// Anything that breaks outside a form is still written down for the problem report.
window.addEventListener('error', (e) => {
  if (!/ResizeObserver loop/.test(e.message)) logProblem('Unexpected error', e.error ?? e.message);
});
window.addEventListener('unhandledrejection', (e) => logProblem('Unexpected error', e.reason));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashGuard>
      <App />
    </CrashGuard>
  </StrictMode>,
);
