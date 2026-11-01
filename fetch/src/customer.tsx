import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './customer/App';
import { registerSW } from './ui/Bits';

registerSW();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
