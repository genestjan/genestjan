import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, Printer, Send, Trash2 } from 'lucide-react';
import { db } from '@/data/db';
import { approveEstimateToJob, saveEstimate } from '@/data/actions';
import { useLiveQuery, useProducts, useServices, useSettings, useStockMap } from '@/data/hooks';
import { available } from '@/domain/stock';
import { findConflicts, jobTotals } from '@/domain/jobs';
import { minsLabel } from '@/domain/util';
import type { Estimate, EstimateStatus, JobLine } from '@/domain/types';
import { Badge, Button, Card, Empty, Field, Modal, MoneyInput, PageHeader, SearchBox, Section, Segmented, Stat, Stepper, Textarea, Money, run, toast, cx } from '@/ui/kit';
import { addLine, addMinsISO, bikeLabel, fromLocalInput, laborLine, matchProduct, matchService, nextHalfHour, partLine, quoteHtml, quoteText, setLinePrice, setLineQty, toLocalInput } from './helpers';
import { CustomerBikePicker, ScheduleFields, type ScheduleValue } from './parts';
import { NotifyModal } from './NotifyPanel';

export default function EstimateBuilder() {
  const { id = 'new' } = useParams();
  const [qs] = useSearchParams();
  const nav = useNavigate();
  const isNew = id === 'new';
  const existing = useLiveQuery(async () => (isNew ? null : (await db.estimates.get(id)) ?? null), [id]);

  const [loaded, setLoaded] = useState(false);
  const [customerId, setCustomerId] = useState(qs.get('customer') ?? '');
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [lines, setLines] = useState<JobLine[]>([]);
  const [complaint, setComplaint] = useState('');
  const [status, setStatus] = useState<EstimateStatus>('draft');
  const [estId, setEstId] = useState<string | undefined>(isNew ? undefined : id);

  useEffect(() => {
    if (isNew || loaded || existing === undefined) return;
    if (existing) {
      setCustomerId(existing.customerId);
      setBikeId(existing.bikeId);
      setLines(existing.lines);
      setComplaint(existing.complaint);
      setStatus(existing.status);
    }
    setLoaded(true);
  }, [existing, isNew, loaded]);

  const settings = useSettings();
  const customer = useLiveQuery(() => (customerId ? db.customers.get(customerId) : undefined), [customerId]);
  const bike = useLiveQuery(() => (bikeId ? db.bikes.get(bikeId) : undefined), [bikeId]);
  const linkedJob = useLiveQuery(() => (estId ? db.workOrders.filter((w) => w.estimateId === estId).first() : undefined), [estId]);
  const totals = jobTotals(lines);
  const locked = status === 'converted';

  const [saved, setSaved] = useState<Estimate | null>(null);
  const [notify, setNotify] = useState(false);
  const [approve, setApprove] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);

  if (!isNew && existing === undefined) return <PageHeader title="Estimate" sub="Loading" />;
  if (!isNew && existing === null) return <Empty title="Estimate not found" action={<Link to="/repairs" className="text-brand">Back to repairs</Link>} />;

  const persist = async (st: EstimateStatus = status) => {
    if (!customerId) throw new Error('Choose a customer first');
    const e = await saveEstimate({ id: estId, customerId, bikeId, lines, status: st, complaint });
    setEstId(e.id);
    setStatus(e.status);
    setSaved(e);
    if (isNew) nav(`/repairs/estimate/${e.id}`, { replace: true });
    return e;
  };

  const estNo = saved?.estNo ?? existing?.estNo ?? 'New quote';
  const quoteInput = { shop: settings?.shopName ?? 'Bikemoko', estNo, customer: customer?.name ?? '', bike: bikeLabel(bike), complaint, lines };

  const sendQuote = async () => {
    if (!lines.length) throw new Error('Add at least one line first');
    const e = await persist('sent');
    setSaved(e);
    setNotify(true);
  };

  return (
    <div>
      <PageHeader
        title={estNo}
        sub={customer ? `${customer.name}${bike ? ` / ${bikeLabel(bike)}` : ''}` : 'Build a quote for the customer'}
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => nav('/repairs')}>
              Back
            </Button>
            <Badge tone={locked ? 'brand' : status === 'sent' ? 'info' : 'neutral'}>{status}</Badge>
          </>
        }
      />
      {locked && (
        <Card className="mb-4 border-brand/40">
          This estimate is already booked as a job. {linkedJob && <Link className="font-semibold text-brand" to={`/jobs/${linkedJob.id}`}>Open {linkedJob.jobNo}</Link>}
        </Card>
      )}

      <Card className="mb-4">
        <CustomerBikePicker customerId={customerId} bikeId={bikeId} disabled={locked} onChange={(c, b) => (setCustomerId(c), setBikeId(b))} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Catalogue disabled={locked} onAdd={(l) => setLines((x) => addLine(x, l))} />

        <div className="grid content-start gap-4">
          <Section title="Quote lines">
            {lines.length ? (
              <div className="grid gap-2">
                {lines.map((l) => (
                  <LineRow key={l.id} line={l} disabled={locked} onQty={(q) => setLines(setLineQty(lines, l.id, q))} onPrice={(p) => setLines(setLinePrice(lines, l.id, p))} />
                ))}
              </div>
            ) : (
              <Empty title="No lines yet" sub="Tap a service or part on the left to add it." />
            )}
          </Section>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Parts" value={<Money value={totals.parts} />} />
            <Stat label="Labour" value={<Money value={totals.labor} />} />
            <Stat label="Total" tone="brand" value={<Money value={totals.total} />} />
            <Stat label="Duration" value={minsLabel(totals.durationMins)} />
          </div>

          <Field label="Complaint">
            <Textarea disabled={locked} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder="What does the customer say is wrong?" />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button disabled={locked} onClick={() => run(() => persist(), 'Draft saved')}>
              Save draft
            </Button>
            <Button disabled={locked || !lines.length} icon={<Send className="h-4 w-4" />} onClick={() => run(sendQuote)}>
              Send quote
            </Button>
            <Button disabled={!lines.length} icon={<Printer className="h-4 w-4" />} onClick={() => setQuoteOpen(true)}>
              Quote
            </Button>
            <Button
              variant="primary"
              disabled={locked || !lines.length || !customerId}
              onClick={() => (!customerId ? toast.bad('Choose a customer first') : setApprove(true))}
            >
              Approve and schedule
            </Button>
          </div>
        </div>
      </div>

      <QuoteModal open={quoteOpen} onClose={() => setQuoteOpen(false)} input={quoteInput} />
      {notify && customerId && (
        <NotifyModal
          open
          title="Send the quote"
          onClose={() => setNotify(false)}
          workOrderId={null}
          customerId={customerId}
          trigger="estimate_ready"
          estimate={{ ref: estNo, bikeId, total: totals.total }}
        />
      )}
      {approve && (
        <ApproveModal
          totalMins={totals.durationMins}
          onClose={() => setApprove(false)}
          create={async (sched, deposit) => {
            const e = await persist();
            const wo = await approveEstimateToJob(e.id, sched, deposit);
            toast.ok(`Booked as ${wo.jobNo}`);
            nav(`/jobs/${wo.id}`);
          }}
        />
      )}
    </div>
  );
}

function Catalogue({ onAdd, disabled }: { onAdd: (l: JobLine) => void; disabled?: boolean }) {
  const services = useServices();
  const products = useProducts();
  const stock = useStockMap();
  const [tab, setTab] = useState<'labor' | 'parts'>('labor');
  const [q, setQ] = useState('');
  const svc = useMemo(() => services.filter((s) => matchService(s, q)).sort((a, b) => a.name.localeCompare(b.name)), [services, q]);
  const prods = useMemo(() => products.filter((p) => matchProduct(p, q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40), [products, q]);
  return (
    <Section title="Add to quote">
      <div className="grid gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'labor', label: 'Labour' }, { value: 'parts', label: 'Parts' }]} />
        <SearchBox value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder={tab === 'labor' ? 'Search services' : 'Search parts by name, SKU or brand'} />
        <div className="grid max-h-[480px] gap-2 overflow-y-auto pr-1">
          {tab === 'labor' &&
            svc.map((s) => (
              <button key={s.id} disabled={disabled} type="button" onClick={() => onAdd(laborLine(s))} className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-line bg-raised px-3.5 py-2 text-left transition hover:border-brand/50 disabled:opacity-50">
                <span>
                  <span className="block text-sm font-semibold">{s.name}</span>
                  <span className="text-xs text-muted">{minsLabel(s.durationMins)}</span>
                </span>
                <Money value={s.laborFee} strong />
              </button>
            ))}
          {tab === 'parts' &&
            prods.map((p) => {
              const av = available(stock.get(p.id, 'STORE'));
              return (
                <button key={p.id} disabled={disabled} type="button" onClick={() => onAdd(partLine(p))} className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-line bg-raised px-3.5 py-2 text-left transition hover:border-brand/50 disabled:opacity-50">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <span className="num">{p.sku}</span>
                      {av > 0 ? <span className="num text-ok">{av} in store</span> : <Badge tone="warn">Will order</Badge>}
                    </span>
                  </span>
                  <Money value={p.price} strong />
                </button>
              );
            })}
          {((tab === 'labor' && !svc.length) || (tab === 'parts' && !prods.length)) && <Empty title="Nothing found" sub="Try a different word." />}
        </div>
      </div>
    </Section>
  );
}

function LineRow({ line, onQty, onPrice, disabled }: { line: JobLine; onQty: (n: number) => void; onPrice: (c: number) => void; disabled?: boolean }) {
  const stock = useStockMap();
  const short = line.kind === 'part' && available(stock.get(line.refId, 'STORE')) < line.qty;
  return (
    <Card pad={false} className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{line.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            {line.kind === 'labor' ? `Labour, ${minsLabel(line.durationMins)} each` : 'Part'}
            {short && <Badge tone="warn">Will order</Badge>}
          </div>
        </div>
        <button type="button" disabled={disabled} aria-label={`Remove ${line.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-faint hover:text-bad" onClick={() => onQty(0)}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Stepper value={line.qty} min={1} onChange={onQty} />
        <MoneyInput className="w-32" value={line.unitPrice} onChange={onPrice} />
        <Money className={cx('ml-auto text-base')} strong value={line.qty * line.unitPrice} />
      </div>
    </Card>
  );
}

function QuoteModal({ open, onClose, input }: { open: boolean; onClose: () => void; input: Parameters<typeof quoteText>[0] }) {
  const text = quoteText(input);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.ok('Quote text copied');
    } catch {
      toast.bad('Could not copy. Select the text and copy by hand.');
    }
  };
  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return toast.bad('Allow pop-ups to print');
    w.document.write(quoteHtml(input));
    w.document.close();
    w.focus();
    w.print();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quote"
      footer={
        <>
          <Button className="flex-1" icon={<Copy className="h-4 w-4" />} onClick={copy}>
            Copy quote text
          </Button>
          <Button className="flex-1" variant="primary" icon={<Printer className="h-4 w-4" />} onClick={print}>
            Print
          </Button>
        </>
      }
    >
      <pre className="whitespace-pre-wrap rounded-xl border border-line bg-raised p-4 font-sans text-sm">{text}</pre>
    </Modal>
  );
}

function ApproveModal({ totalMins, onClose, create }: { totalMins: number; onClose: () => void; create: (s: { mechanicId: string; bay: string; start: string; end: string }, deposit: number) => Promise<void> }) {
  const jobs = useLiveQuery(() => db.workOrders.toArray(), [], []);
  const [sched, setSched] = useState<ScheduleValue>(() => ({ mechanicId: '', bay: 'Bay 1', start: toLocalInput(nextHalfHour()) }));
  const [deposit, setDeposit] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = sched.start ? fromLocalInput(sched.start) : '';
  const end = start ? addMinsISO(start, Math.max(30, totalMins)) : '';
  const clash = start && sched.mechanicId ? findConflicts(jobs, { mechanicId: sched.mechanicId, bay: sched.bay, start, end })[0] : undefined;

  const go = async () => {
    setError('');
    if (!sched.mechanicId) return setError('Choose a mechanic');
    if (!start) return setError('Choose a start time');
    setBusy(true);
    try {
      await create({ mechanicId: sched.mechanicId, bay: sched.bay, start, end }, deposit);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} wide title="Approve and schedule" footer={<Button variant="primary" block loading={busy} onClick={go}>Approve and book job</Button>}>
      <div className="grid gap-4">
        <ScheduleFields value={sched} onChange={setSched} />
        <p className="text-xs text-muted">Booked for {minsLabel(Math.max(30, totalMins))}.</p>
        <Field label="Deposit">
          <MoneyInput value={deposit} onChange={setDeposit} />
        </Field>
        {clash && <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">Clash with job {clash.jobNo} ({clash.bay}). Pick another time, bay or mechanic.</p>}
        {error && <p className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{error}</p>}
      </div>
    </Modal>
  );
}
