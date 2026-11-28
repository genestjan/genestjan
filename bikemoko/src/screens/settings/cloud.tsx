import { useCallback, useEffect, useState } from 'react';
import { Cloud, CloudOff, LogOut, RefreshCw, Upload } from 'lucide-react';
import { Badge, Button, Card, Field, Input, Modal, Section, Select, run, cx } from '@/ui/kit';
import { useStaff } from '@/data/hooks';
import {
  cloudConfigured, currentLogin, linkMyLogin, listUnlinkedStaff, retryFailed, signIn, signOut, syncStatus, uploadLocalSnapshot, type SyncStatus,
} from '@/data/sync';
import { useSession } from '@/app/session';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fail = (msg: string | null) => {
  if (msg) throw new Error(msg);
};

function useCloud() {
  const [login, setLogin] = useState<{ email: string } | null | undefined>(undefined);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const refresh = useCallback(async () => {
    setLogin(await currentLogin());
    setStatus(await syncStatus());
  }, []);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void syncStatus().then(setStatus), 2000);
    return () => clearInterval(t);
  }, [refresh]);
  return { login, status, refresh };
}

export function CloudTab() {
  const { login, status, refresh } = useCloud();
  if (!cloudConfigured()) {
    return (
      <Section title="Cloud">
        <Card className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-raised text-muted">
            <CloudOff className="h-5 w-5" />
          </span>
          <div>
            <div className="font-semibold">Local only</div>
            <p className="mt-0.5 text-sm text-muted">
              This copy of the app keeps everything on this device and does not share it. Your data is safe here. Make a backup on the Data tab before changing phones or computers.
            </p>
          </div>
        </Card>
      </Section>
    );
  }
  return (
    <div className="space-y-8">
      <SignInCard login={login} onChange={refresh} />
      <StatusCard status={status} signedIn={!!login} onChange={refresh} />
      {login && <LinkCard onChange={refresh} />}
      {login && <UploadCard />}
    </div>
  );
}

function SignInCard({ login, onChange }: { login: { email: string } | null | undefined; onChange: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    await run(async () => {
      fail(await signIn(email.trim(), password));
      setPassword('');
      await onChange();
    }, 'Signed in');
    setBusy(false);
  };
  return (
    <Section title="Shop cloud login">
      {login ? (
        <Card className="flex flex-wrap items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ok/12 text-ok">
            <Cloud className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Signed in</div>
            <p className="truncate text-sm text-muted">{login.email}</p>
          </div>
          <Button icon={<LogOut className="h-4 w-4" />} onClick={() => run(async () => { await signOut(); await onChange(); }, 'Signed out')}>Sign out</Button>
        </Card>
      ) : (
        <Card>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <p className="text-sm text-muted">Sign in with the email and password for the shop cloud. Nothing is shared until you do.</p>
            <Field label="Email">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" variant="primary" disabled={busy || !email.trim() || !password}>Sign in</Button>
          </form>
        </Card>
      )}
    </Section>
  );
}

function StatusCard({ status, signedIn, onChange }: { status: SyncStatus | null; signedIn: boolean; onChange: () => Promise<void> }) {
  const s = status;
  const last = s?.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString() : 'Not yet';
  return (
    <Section title="Sync status">
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Readout label="Waiting to send" value={s ? String(s.pending) : '...'} />
          <Readout label="Failed" value={s ? String(s.failed) : '...'} tone={s && s.failed > 0 ? 'text-bad' : undefined} />
          <Readout label="Last synced" value={last} small />
          <div>
            <div className="text-[13px] font-medium text-muted">Live updates</div>
            <div className="mt-1.5">
              <Badge tone={s?.realtime ? 'ok' : 'neutral'} dot>{s?.realtime ? 'On' : 'Off'}</Badge>
            </div>
          </div>
        </div>
        {!signedIn && <p className="text-sm text-muted">Sign in above to start syncing. Changes wait safely on this device until then.</p>}
        {signedIn && s?.error && <p className="text-sm text-warn">{s.error}. Changes are kept and will be sent when it works again.</p>}
        {s && s.failed > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-muted">
              {plural(s.failed, 'change')} could not be accepted by the cloud (for example, not enough stock there). Press retry once the cause is fixed.
            </p>
            <Button
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => run(async () => { const n = await retryFailed(); await onChange(); return n; }, 'Queued to try again')}
            >
              Retry failed
            </Button>
          </div>
        )}
      </Card>
    </Section>
  );
}

function Readout({ label, value, small, tone }: { label: string; value: string; small?: boolean; tone?: string }) {
  return (
    <div>
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className={cx('num mt-1 font-bold', small ? 'text-sm' : 'text-2xl', tone)}>{value}</div>
    </div>
  );
}

function LinkCard({ onChange }: { onChange: () => Promise<void> }) {
  const localStaff = useStaff();
  const [cloudStaff, setCloudStaff] = useState<{ id: string; name: string; role: string }[] | null>(null);
  const [staffId, setStaffId] = useState('');
  const [pin, setPin] = useState('');
  const load = useCallback(async () => setCloudStaff(await listUnlinkedStaff()), []);
  useEffect(() => { void load(); }, [load]);
  // The cloud list is best: it works on a brand new device. Fall back to this device's own staff list.
  const options = cloudStaff ?? localStaff.filter((x) => x.active).map((x) => ({ id: x.id, name: x.name, role: x.role }));
  return (
    <Section title="Link this login to a staff member">
      <Card className="space-y-3">
        <p className="text-sm text-muted">
          Do this once for each person who signs in on a device. Choose who the login belongs to and type their 4-digit PIN. Then the cloud knows what they are allowed to do.
        </p>
        <Field label="Staff member">
          <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Choose a person</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.role})</option>)}
          </Select>
        </Field>
        {cloudStaff && cloudStaff.length === 0 && <p className="text-sm text-muted">Nobody is waiting to be linked. Everyone already has a login, or this login is already linked.</p>}
        <Field label="Their PIN">
          <Input type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value)} />
        </Field>
        <Button
          variant="primary"
          disabled={!staffId || !pin}
          onClick={() => run(async () => { fail(await linkMyLogin(staffId, pin)); setPin(''); setStaffId(''); await load(); await onChange(); }, 'Login linked')}
        >
          Link this login
        </Button>
      </Card>
    </Section>
  );
}

function UploadCard() {
  const { staff, role } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <Section title="First device only">
      <Card className="space-y-3">
        <p className="text-sm text-muted">
          Use this on the first device only, to send its products, stock, staff and customers to an empty shop cloud. The login you are signed in with becomes the owner.
        </p>
        <p className="text-sm font-medium">
          Before you press it, make sure this device has your real data. If it still has the demo data, erase the demo data and import your real products CSV first (Data tab). Otherwise the demo products go to the cloud.
        </p>
        <p className="text-sm text-muted">It works once. If the cloud already has staff or products, it will say no and change nothing.</p>
        <Button icon={<Upload className="h-4 w-4" />} onClick={() => setOpen(true)}>This device is the first one: upload its data</Button>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Upload this device to the cloud?"
        footer={
          <>
            <Button className="flex-1" onClick={() => setOpen(false)}>Not yet</Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => run(async () => { fail(await uploadLocalSnapshot(role === 'owner' ? staff?.id : undefined)); setOpen(false); }, 'Uploaded. This login is now the owner.')}
            >
              Yes, upload
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Everything on this device goes to the cloud as the shop's starting point. Check that the products and stock are your real ones, not the demo data. You can only do this once.
        </p>
      </Modal>
    </Section>
  );
}
