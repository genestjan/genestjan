import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Cloud, CloudOff, Download, FileUp, Lock, Pencil, Plus, RotateCcw, Settings as Cog, Upload } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, Input, Modal, MoneyInput, PageHeader, Section, Segmented, Select, Table, Textarea, Toggle, run, toast, cx } from '@/ui/kit';
import { db } from '@/data/db';
import { useLiveQuery, useProducts, useServices, useSettings, useStaff } from '@/data/hooks';
import { countUnsynced, exportBackup, importProducts, resetDemoData, restoreBackup, saveService, saveSettings, saveStaff, validateBackup, type Backup } from '@/data/settingsActions';
import { useSession } from '@/app/session';
import { money } from '@/domain/util';
import type { Role, Service, Settings, Staff } from '@/domain/types';
import { IMPORT_TEMPLATE, parseProductCsv, type ParsedImport } from './csv';
import { downloadText } from './files';

type Tab = 'shop' | 'staff' | 'services' | 'data' | 'about';

export default function SettingsScreen() {
  const { role } = useSession();
  const [tab, setTab] = useState<Tab>('shop');
  if (role !== 'owner') return <Empty icon={<Lock className="h-5 w-5" />} title="Settings are for the owner" sub="Switch to the owner profile to change shop settings." />;
  return (
    <div className="space-y-6">
      <PageHeader icon={<Cog className="h-5 w-5" />} title="Settings" sub="Shop details, staff, services and data" />
      <div className="overflow-x-auto">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'shop', label: 'Shop' },
            { value: 'staff', label: 'Staff' },
            { value: 'services', label: 'Services' },
            { value: 'data', label: 'Data' },
            { value: 'about', label: 'About' },
          ]}
        />
      </div>
      {tab === 'shop' && <ShopTab />}
      {tab === 'staff' && <StaffTab />}
      {tab === 'services' && <ServicesTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'about' && <AboutTab />}
    </div>
  );
}

// ---------- Shop profile ----------

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourText = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'am' : 'pm'}`;

function ShopTab() {
  const saved = useSettings();
  const [f, setF] = useState<Omit<Settings, 'id'> | null>(null);
  useEffect(() => {
    if (saved && !f) {
      const { id: _id, ...rest } = saved;
      setF(rest);
    }
  }, [saved, f]);
  if (!f) return <p className="text-sm text-muted">Loading...</p>;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x!, [k]: v }));
  const num = (k: 'warrantyDays' | 'deadStockDays' | 'followUpDays') => (e: React.ChangeEvent<HTMLInputElement>) => set(k, parseInt(e.target.value, 10) || 0);
  return (
    <Card className="max-w-2xl space-y-4">
      <Field label="Shop name"><Input value={f.shopName} onChange={(e) => set('shopName', e.target.value)} /></Field>
      <Field label="Address"><Textarea value={f.address} onChange={(e) => set('address', e.target.value)} className="min-h-[64px]" /></Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Phone"><Input inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Facebook page"><Input value={f.facebookPage} onChange={(e) => set('facebookPage', e.target.value)} /></Field>
      </div>
      <Field label="Receipt footer" hint="Printed at the bottom of every receipt."><Input value={f.receiptFooter} onChange={(e) => set('receiptFooter', e.target.value)} /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Warranty (days)"><Input inputMode="numeric" value={f.warrantyDays || ''} onChange={num('warrantyDays')} /></Field>
        <Field label="Dead stock after (days)" hint="No sales for this long"><Input inputMode="numeric" value={f.deadStockDays || ''} onChange={num('deadStockDays')} /></Field>
        <Field label="Follow up after (days)" hint="Since last repair"><Input inputMode="numeric" value={f.followUpDays || ''} onChange={num('followUpDays')} /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Opens">
          <Select value={f.openHour} onChange={(e) => set('openHour', Number(e.target.value))}>{HOURS.map((h) => <option key={h} value={h}>{hourText(h)}</option>)}</Select>
        </Field>
        <Field label="Closes">
          <Select value={f.closeHour} onChange={(e) => set('closeHour', Number(e.target.value))}>{HOURS.map((h) => <option key={h} value={h}>{hourText(h)}</option>)}</Select>
        </Field>
      </div>
      <Button variant="primary" onClick={() => run(() => saveSettings(f), 'Shop details saved')}>Save shop details</Button>
    </Card>
  );
}

// ---------- Staff ----------

export const LANE_COLORS = ['#f97316', '#38bdf8', '#22c55e', '#a78bfa', '#facc15', '#f43f5e', '#14b8a6', '#ec4899'];
const STARTER_PINS = new Set(['1234', '1111', '2222', '3333', '4444']);
const ROLES: { value: Role; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'advisor', label: 'Service advisor' },
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'warehouse', label: 'Warehouse' },
];
const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;

function StaffTab() {
  const staff = useStaff();
  const [edit, setEdit] = useState<Partial<Staff> | null>(null);
  const starter = staff.filter((s) => s.active && STARTER_PINS.has(s.pin));
  return (
    <div className="space-y-4">
      {starter.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div className="text-sm">
            <div className="font-semibold">Change the starter PINs</div>
            <p className="text-muted">{starter.map((s) => s.name).join(', ')} still {starter.length === 1 ? 'uses' : 'use'} a PIN that came with the app. Anyone who has seen the demo knows them. Tap a name below and set a new 4-digit PIN.</p>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ role: 'cashier', skills: [], dailyCapacityMins: 0, color: LANE_COLORS[staff.length % LANE_COLORS.length], active: true, pin: '' })}>Add staff</Button>
      </div>
      <Table
        rows={staff}
        rowKey={(s) => s.id}
        onRow={setEdit}
        empty={<Empty title="No staff yet" />}
        cols={[
          { key: 'n', label: 'Name', cell: (s) => <span className="flex items-center gap-2.5 font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: s.color }} />{s.name}</span> },
          { key: 'r', label: 'Role', cell: (s) => roleLabel(s.role) },
          { key: 's', label: 'Skills', cell: (s) => <span className="text-muted">{s.skills.join(', ') || '-'}</span> },
          { key: 'c', label: 'Daily capacity', align: 'right', cell: (s) => (s.dailyCapacityMins ? `${s.dailyCapacityMins} min` : '-') },
          { key: 'p', label: 'PIN', cell: (s) => (STARTER_PINS.has(s.pin) ? <Badge tone="warn">Starter PIN</Badge> : <span className="text-muted">Set</span>) },
          { key: 'a', label: 'Status', cell: (s) => <Badge tone={s.active ? 'ok' : 'neutral'}>{s.active ? 'Active' : 'Inactive'}</Badge> },
        ]}
      />
      {edit && <StaffModal key={edit.id ?? 'new'} initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function StaffModal({ initial, onClose }: { initial: Partial<Staff>; onClose: () => void }) {
  const [f, setF] = useState({
    name: initial.name ?? '',
    role: (initial.role ?? 'cashier') as Role,
    pin: initial.pin ?? '',
    skills: (initial.skills ?? []).join(', '),
    dailyCapacityMins: initial.dailyCapacityMins ?? 0,
    color: initial.color ?? LANE_COLORS[0],
    active: initial.active ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'Edit staff' : 'Add staff'}
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => run(async () => {
            await saveStaff({ ...f, id: initial.id, skills: f.skills.split(',') });
            onClose();
          }, 'Staff saved')}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name"><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <Select value={f.role} onChange={(e) => set('role', e.target.value as Role)}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select>
          </Field>
          <Field label="4-digit PIN" error={f.pin && !/^\d{4}$/.test(f.pin) ? 'Use exactly 4 digits' : undefined}>
            <Input inputMode="numeric" maxLength={4} value={f.pin} onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        <Field label="Skills" hint="Separate with commas, e.g. brakes, wheel truing"><Input value={f.skills} onChange={(e) => set('skills', e.target.value)} /></Field>
        <Field label="Daily capacity (minutes)" hint="Mechanics only. 480 is an 8 hour day."><Input inputMode="numeric" value={f.dailyCapacityMins || ''} onChange={(e) => set('dailyCapacityMins', parseInt(e.target.value, 10) || 0)} /></Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">Calendar colour</span>
          <div className="flex flex-wrap gap-2">
            {LANE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={f.color === c}
                onClick={() => set('color', c)}
                className={cx('h-11 w-11 rounded-full border-2 transition', f.color === c ? 'border-ink' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Active (can sign in)" />
      </div>
    </Modal>
  );
}

// ---------- Services ----------

function ServicesTab() {
  const services = useServices();
  const [edit, setEdit] = useState<Partial<Service> | null>(null);
  const sorted = useMemo(() => [...services].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [services]);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ active: true, checklist: [], durationMins: 30, laborFee: 0 })}>Add service</Button>
      </div>
      <Table
        rows={sorted}
        rowKey={(s) => s.id}
        onRow={setEdit}
        empty={<Empty title="No services yet" sub="Services are the labour jobs you charge for, like a tune-up." />}
        cols={[
          { key: 'n', label: 'Service', cell: (s) => <span className="font-semibold">{s.name}</span> },
          { key: 'c', label: 'Category', cell: (s) => <span className="text-muted">{s.category}</span> },
          { key: 'f', label: 'Fee', align: 'right', cell: (s) => money(s.laborFee) },
          { key: 'd', label: 'Time', align: 'right', cell: (s) => `${s.durationMins} min` },
          { key: 'k', label: 'Checklist', align: 'right', cell: (s) => `${s.checklist.length} step${s.checklist.length === 1 ? '' : 's'}` },
          { key: 'a', label: '', cell: (s) => (s.active ? <Pencil className="h-4 w-4 text-faint" /> : <Badge>Hidden</Badge>) },
        ]}
      />
      {edit && <ServiceModal key={edit.id ?? 'new'} initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ServiceModal({ initial, onClose }: { initial: Partial<Service>; onClose: () => void }) {
  const [f, setF] = useState({
    name: initial.name ?? '',
    category: initial.category ?? '',
    laborFee: initial.laborFee ?? 0,
    durationMins: initial.durationMins ?? 30,
    checklist: (initial.checklist ?? []).join('\n'),
    active: initial.active ?? true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'Edit service' : 'Add service'}
      footer={
        <>
          <Button className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => run(async () => {
            await saveService({ ...f, id: initial.id, checklist: f.checklist.split('\n') });
            onClose();
          }, 'Service saved')}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Service name"><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Category"><Input value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Brakes, Wheels, Drivetrain" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Labour fee"><MoneyInput value={f.laborFee} onChange={(v) => set('laborFee', v)} /></Field>
          <Field label="Time (minutes)"><Input inputMode="numeric" value={f.durationMins || ''} onChange={(e) => set('durationMins', parseInt(e.target.value, 10) || 0)} /></Field>
        </div>
        <Field label="Checklist" hint="One step per line. Mechanics tick these off."><Textarea value={f.checklist} onChange={(e) => set('checklist', e.target.value)} className="min-h-[120px]" /></Field>
        <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Offer this service" />
      </div>
    </Modal>
  );
}

// ---------- Data ----------

function DataTab() {
  return (
    <div className="space-y-8">
      <SyncCard />
      <ImportCard />
      <BackupCard />
    </div>
  );
}

function SyncCard() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const unsynced = useLiveQuery(() => countUnsynced(), []) ?? 0;
  return (
    <Section title="Cloud sync">
      <Card className="flex items-start gap-3">
        <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', url ? 'bg-ok/12 text-ok' : 'bg-raised text-muted')}>
          {url ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
        </span>
        <div>
          <div className="font-semibold">{url ? 'Connected' : "Local only: this device's data is not shared yet"}</div>
          <p className="mt-0.5 text-sm text-muted">
            {url
              ? 'Changes are sent to the shop cloud when this device is online.'
              : `${unsynced} change${unsynced === 1 ? '' : 's'} waiting to be shared. They are safe on this device. Make a backup below before changing phones or computers.`}
          </p>
          {url && <p className="mt-0.5 text-sm text-muted">{unsynced} change{unsynced === 1 ? '' : 's'} not sent yet.</p>}
        </div>
      </Card>
    </Section>
  );
}

function ImportCard() {
  const { staff } = useSession();
  const products = useProducts();
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const have = useMemo(() => new Set(products.map((p) => p.sku.toLowerCase())), [products]);

  const view = useMemo(() => {
    if (!parsed) return null;
    const rows = parsed.rows.map((r) => {
      const dup = r.row && have.has(r.row.sku.toLowerCase());
      return { ...r, dup: !!dup };
    });
    const ready = rows.filter((r) => r.row && !r.dup);
    return { rows, ready, bad: rows.filter((r) => !r.row).length, dup: rows.filter((r) => r.dup).length };
  }, [parsed, have]);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setParsed(parseProductCsv(await file.text()));
  };

  return (
    <Section title="Import products from CSV">
      <Card className="space-y-4">
        <p className="text-sm text-muted">Columns: sku, barcode, name, category, brand, cost, price, store_qty, warehouse_qty, store_reorder, warehouse_reorder, serialized. Only sku, name and price are required. Products whose SKU already exists are skipped.</p>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void load(e.target.files?.[0]); e.target.value = ''; }} />
          <Button icon={<FileUp className="h-4 w-4" />} onClick={() => input.current?.click()}>Choose CSV file</Button>
          <Button variant="ghost" icon={<Download className="h-4 w-4" />} onClick={() => downloadText('bikemoko-products-template.csv', IMPORT_TEMPLATE, 'text/csv')}>Download template</Button>
        </div>
        {parsed?.fatal && <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{parsed.fatal}</p>}
        {view && !parsed?.fatal && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">{fileName}</span>
              <Badge tone="ok">{view.ready.length} ready</Badge>
              {view.dup > 0 && <Badge tone="warn">{view.dup} already in catalogue</Badge>}
              {view.bad > 0 && <Badge tone="bad">{view.bad} with problems</Badge>}
            </div>
            <div className="max-h-80 overflow-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-raised text-left text-xs uppercase tracking-wider text-faint">
                  <tr>{['Line', 'SKU', 'Name', 'Price', 'Store', 'Warehouse', 'Check'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {view.rows.slice(0, 200).map((r) => (
                    <tr key={r.line} className="border-t border-line/70">
                      <td className="num px-3 py-2 text-muted">{r.line}</td>
                      <td className="px-3 py-2">{r.row?.sku ?? ''}</td>
                      <td className="px-3 py-2">{r.row?.name ?? ''}</td>
                      <td className="num px-3 py-2">{r.row ? money(r.row.price) : ''}</td>
                      <td className="num px-3 py-2">{r.row?.storeQty ?? ''}</td>
                      <td className="num px-3 py-2">{r.row?.warehouseQty ?? ''}</td>
                      <td className="px-3 py-2">{r.errors.length ? <span className="text-bad">{r.errors.join(', ')}</span> : r.dup ? <span className="text-warn">Already exists, will skip</span> : <span className="text-ok">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {view.rows.length > 200 && <p className="text-xs text-faint">Showing the first 200 of {view.rows.length} rows. All rows are checked.</p>}
            <div className="flex gap-2">
              <Button
                variant="primary"
                disabled={!view.ready.length}
                onClick={() => run(async () => {
                  const res = await importProducts(view.ready.map((r) => r.row!), staff?.id);
                  setParsed(null);
                  setFileName('');
                  if (res.skippedSkus.length) toast.info(`${res.skippedSkus.length} skipped because the SKU already exists`);
                }, `Imported ${view.ready.length} product${view.ready.length === 1 ? '' : 's'}`)}
              >
                Import {view.ready.length} product{view.ready.length === 1 ? '' : 's'}
              </Button>
              <Button variant="ghost" onClick={() => { setParsed(null); setFileName(''); }}>Cancel</Button>
            </div>
            {view.bad > 0 && <p className="text-xs text-faint">Rows with problems are left out. Fix them in the file and import again.</p>}
          </>
        )}
      </Card>
    </Section>
  );
}

function BackupCard() {
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [reset, setReset] = useState<0 | 1 | 2>(0);

  const readBackup = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const err = validateBackup(data);
      if (err) toast.bad(err);
      else setPending(data as Backup);
    } catch {
      toast.bad('That file could not be read as a backup.');
    }
  };

  return (
    <Section title="Backup and reset">
      <Card className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold">Export a full backup</h3>
          <p className="mb-2 mt-0.5 text-sm text-muted">One file with everything: products, stock, sales, repairs, customers and staff.</p>
          <Button icon={<Download className="h-4 w-4" />} onClick={() => run(async () => {
            const b = await exportBackup();
            downloadText(`bikemoko-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), 'application/json');
          }, 'Backup saved')}>Download backup</Button>
        </div>
        <div className="border-t border-line pt-5">
          <h3 className="text-sm font-semibold">Restore from a backup</h3>
          <p className="mb-2 mt-0.5 text-sm text-muted">This replaces everything on this device with the file.</p>
          <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { void readBackup(e.target.files?.[0]); e.target.value = ''; }} />
          <Button icon={<Upload className="h-4 w-4" />} onClick={() => file.current?.click()}>Choose backup file</Button>
        </div>
        <div className="border-t border-line pt-5">
          <h3 className="text-sm font-semibold">Reset demo data</h3>
          <p className="mb-2 mt-0.5 text-sm text-muted">Erases everything and loads the starter products again. Only for testing.</p>
          <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setReset(1)}>Reset demo data</Button>
        </div>
      </Card>

      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Replace all data?"
        footer={
          <>
            <Button className="flex-1" onClick={() => setPending(null)}>Keep my data</Button>
            <Button variant="danger" className="flex-1" onClick={() => run(async () => { await restoreBackup(pending); setPending(null); }, 'Backup restored')}>Replace with backup</Button>
          </>
        }
      >
        {pending && (
          <p className="text-sm text-muted">
            This backup was saved on {new Date(pending.exportedAt).toLocaleString('en-PH')} and has {pending.tables.products.length} products, {pending.tables.sales.length} sales and {pending.tables.customers.length} customers. Everything on this device now will be erased and replaced.
          </p>
        )}
      </Modal>

      <Modal
        open={reset === 1}
        onClose={() => setReset(0)}
        title="Reset demo data?"
        footer={
          <>
            <Button className="flex-1" onClick={() => setReset(0)}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={() => setReset(2)}>Continue</Button>
          </>
        }
      >
        <p className="text-sm text-muted">All sales, repairs, customers and stock on this device will be erased and replaced with the demo data.</p>
      </Modal>
      <Modal
        open={reset === 2}
        onClose={() => setReset(0)}
        title="Last check"
        footer={
          <>
            <Button className="flex-1" onClick={() => setReset(0)}>No, keep everything</Button>
            <Button variant="danger" className="flex-1" onClick={() => run(async () => { await resetDemoData(); setReset(0); }, 'Demo data restored')}>Yes, erase it all</Button>
          </>
        }
      >
        <p className="text-sm text-muted">This cannot be undone. If you are not sure, download a backup first.</p>
      </Modal>
    </Section>
  );
}

// ---------- About ----------

function AboutTab() {
  const counts = useLiveQuery(async () => ({ products: await db.products.count(), customers: await db.customers.count(), sales: await db.sales.count() }), []);
  return (
    <Card className="max-w-xl">
      <div className="font-display text-xl font-bold">Bikemoko Unified Inventory, POS &amp; Service Repair</div>
      <p className="mt-1 text-sm text-muted">One system for the store, the warehouse and the workshop.</p>
      {counts && <p className="num mt-3 text-sm text-muted">{counts.products} products, {counts.customers} customers, {counts.sales} sales on this device.</p>}
    </Card>
  );
}
