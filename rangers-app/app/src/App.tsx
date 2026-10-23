import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Squad from './pages/Squad';
import MatchSetup from './pages/MatchSetup';
import Live from './pages/Live';
import Present from './pages/Present';
import Board from './pages/Board';
import { loadState } from './lib/store';

export default function App() {
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    void loadState().then(() => setReady(true));
    const u = () => setOnline(navigator.onLine);
    window.addEventListener('online', u); window.addEventListener('offline', u);
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u); };
  }, []);
  if (!ready) return null;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      {!online && <div className="bg-red px-4 py-1 text-center text-sm text-white">Offline: everything still works and is saved on this device.</div>}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/squad" element={<Squad />} />
        <Route path="/board" element={<Board />} />
        <Route path="/match/:id" element={<MatchSetup />} />
        <Route path="/match/:id/live" element={<Live />} />
        <Route path="/match/:id/present" element={<Present />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
