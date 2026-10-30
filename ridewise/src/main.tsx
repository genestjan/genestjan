import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startClarity } from './lib/clarity';
import './index.css';

startClarity();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
