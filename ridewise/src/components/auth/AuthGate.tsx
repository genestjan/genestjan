import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { useStore } from '../../store/store';
import { Tutorial } from '../Tutorial';
import { openSampleRide } from '../../lib/sampleRide';
import { ChooseRider, OpenChoice, Unlock, Welcome } from './Screens';
import { Mascot } from '../Mascot';

/** Nothing inside renders until a rider is signed in. The shared-plan page sits outside this gate. */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuth((s) => s.status);
  const justRegistered = useAuth((s) => s.justRegistered);
  const readFailed = useAuth((s) => s.readFailed);
  const hydrated = useStore((s) => s.hydrated);
  const tutorialDone = useStore((s) => s.prefs.tutorialDone);
  const setPrefs = useStore((s) => s.setPrefs);
  const nav = useNavigate();

  if (status === 'loading')
    return (
      <div className="grid min-h-dvh place-items-center bg-navy text-white" role="status">
        <div className="flex flex-col items-center gap-3">
          <Mascot size={96} />
          <p className="text-lg font-semibold">Getting ready…</p>
        </div>
      </div>
    );
  if (status === 'welcome') return <Welcome />;
  if (status === 'choose') return <ChooseRider />;
  if (status === 'locked') return <Unlock />;
  if (justRegistered) return <OpenChoice />;
  if (!hydrated) return <p className="p-6" role="status">Opening your rides…</p>;

  return (
    <>
      {readFailed && (
        <p role="alert" className="bg-danger px-4 py-3 text-center text-base font-semibold text-white">
          I could not read your saved rides, so I am not saving anything new right now. Please close and open the app again.
        </p>
      )}
      {children}
      {!tutorialDone && (
        <Tutorial
          onFinish={async (trySample) => {
            setPrefs({ tutorialDone: true });
            if (trySample) {
              await openSampleRide();
              nav('/map');
            }
          }}
        />
      )}
    </>
  );
}

/** Starts sign-in checks once when the app opens. */
export function useAuthInit() {
  useEffect(() => {
    void useAuth.getState().init();
  }, []);
}
