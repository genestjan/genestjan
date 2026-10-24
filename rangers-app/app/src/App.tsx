import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Today from './pages/Today';
import Squad from './pages/Squad';
import PlayerProfile from './pages/Player';
import MatchList from './pages/Home';
import MatchSetup from './pages/MatchSetup';
import Live from './pages/Live';
import Present from './pages/Present';
import Tv from './pages/Tv';
import Schedule, { EventDetail, EventForm } from './pages/Schedule';
import Inbox, { Thread } from './pages/Inbox';
import Train, { DrillDetail, Drills, RunSession } from './pages/Train';
import { Review, ReviewList } from './pages/Review';
import Recognise from './pages/Recognise';
import Safety from './pages/Safety';
import Support from './pages/Support';
import BoardEditor from './pages/BoardEditor';
import More, { Help, Motivation, Privacy, Settings, Tips } from './pages/More';
import { DetailsPage, DocsPage, ParentHome, ProgressPage, TeamDocs } from './pages/Parent';
import { EligibilityEditor, Pathway } from './pages/School';
import { AttendanceHome, AttendanceReport, TakeAttendance } from './pages/Attendance';
import { PickSquad } from './pages/Pick';
import { Gate, Join, LocalChoice, Login, pendingInvite } from './pages/Auth';
import { TabBar } from './components/ui';
import { Welcome } from './components/Onboarding';
import { GuideOverlay } from './components/Guide';
import { startGuide } from './lib/guide';
import { tourRole, useTour, useWelcome } from './lib/onboarding';
import { AssignDetail, AssignList, AssignNew } from './pages/Assign';
import { TaskDetail, Tasks } from './pages/Tasks';
import { loadState, useAppState } from './lib/store';
import { cloudEnabled, init as initCloud, useCloud } from './lib/cloud';
import { isStaff, useRole } from './lib/role';
import { useParams } from 'react-router-dom';

const ProgressRoute = () => { const { id } = useParams(); return <ProgressPage playerId={id} />; };

function Shell() {
  const role = useRole(); const staff = isStaff(role); const loc = useLocation(); const s = useAppState();
  const fullscreen = /\/present$|^\/tv$/.test(loc.pathname);
  const tour = useTour(tourRole(role));
  // First time on this phone: walk through the real screens once (replay any time from Help).
  useEffect(() => { if (tour.open && !fullscreen) { tour.done(); startGuide(tourRole(role) === 'parent' ? 'start-parent' : 'start-coach'); } }, [tour.open, fullscreen, role]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <GuideOverlay />
      {s.previewChildId && !cloudEnabled && <div className="bg-crest px-4 py-1 text-center text-sm text-white">Preview: this is what a parent sees. Go to More to return.</div>}
      <Routes>
        <Route path="/" element={staff ? <Today /> : <ParentHome />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/event/new" element={staff ? <EventForm /> : <Navigate to="/schedule" />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/inbox/:playerId" element={<Thread />} />
        <Route path="/more" element={<More />} />
        <Route path="/help" element={<Help />} />
        <Route path="/support" element={<Support />} />
        <Route path="/tips" element={<Tips />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/details/:id" element={<DetailsPage />} />
        <Route path="/docs/:id" element={<DocsPage />} />
        <Route path="/pathway" element={<Pathway />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/progress/:id" element={<ProgressRoute />} />
        <Route path="/tv" element={<Tv />} />
        <Route path="/join/:token" element={<Join />} />
        {staff && (<>
          <Route path="/assign" element={<AssignList />} />
          <Route path="/attendance" element={<AttendanceHome />} />
          <Route path="/attendance/report" element={<AttendanceReport />} />
          <Route path="/attendance/:id" element={<TakeAttendance />} />
          <Route path="/event/:id/squad" element={<PickSquad />} />
          <Route path="/pathway/:id" element={<EligibilityEditor />} />
          <Route path="/documents" element={<TeamDocs />} />
          <Route path="/assign/new" element={<AssignNew />} />
          <Route path="/assign/:groupId" element={<AssignDetail />} />
          <Route path="/squad" element={<Squad />} />
          <Route path="/player/:id" element={<PlayerProfile />} />
          <Route path="/match" element={<MatchList />} />
          <Route path="/match/:id" element={<MatchSetup />} />
          <Route path="/match/:id/live" element={<Live />} />
          <Route path="/match/:id/present" element={<Present />} />
          <Route path="/train" element={<Train />} />
          <Route path="/train/run/:id" element={<RunSession />} />
          <Route path="/drills" element={<Drills />} />
          <Route path="/drills/:id" element={<DrillDetail />} />
          <Route path="/review" element={<ReviewList />} />
          <Route path="/review/:playerId" element={<Review />} />
          <Route path="/recognise" element={<Recognise />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/board" element={<BoardEditor />} />
          <Route path="/motivation" element={<Motivation />} />
          <Route path="/settings" element={<Settings />} />
        </>)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!fullscreen && <TabBar />}
    </>
  );
}

function Gatekeeper() {
  const c = useCloud(); const loc = useLocation(); const w = useWelcome();
  if (loc.pathname.startsWith('/join')) return <Routes><Route path="/join/:token" element={<Join />} /><Route path="*" element={<Join />} /></Routes>;
  if (loc.pathname === '/tv') return <Tv />;
  if (!w.seen) return <Welcome onStart={w.done} />;
  if (!cloudEnabled) return <Shell />;
  if (c.status === 'loading') return <div className="p-8 text-center muted">Loading...</div>;
  if (c.status === 'signed-out') return <Login />;
  // Back from Google sign-in with an invite still waiting: finish joining first.
  if (pendingInvite() && (c.status === 'ready' || c.status === 'no-role')) return <Join />;
  if (c.status === 'local-choice') return <LocalChoice />;
  if (c.status !== 'ready') return <Gate />;
  return <Shell />;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    void loadState().then(() => { setReady(true); void initCloud(); });
    const u = () => setOnline(navigator.onLine);
    window.addEventListener('online', u); window.addEventListener('offline', u);
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u); };
  }, []);
  if (!ready) return null;
  return (
    <HashRouter>
      {!online && <div className="bg-crest px-4 py-1 text-center text-sm text-white">Offline: everything still works and is saved on this device.</div>}
      <Gatekeeper />
    </HashRouter>
  );
}
