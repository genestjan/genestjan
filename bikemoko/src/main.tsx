import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './index.css';

document.documentElement.dataset.theme = (() => {
  try {
    return localStorage.getItem('bm.theme') ?? 'dark';
  } catch {
    return 'dark';
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
