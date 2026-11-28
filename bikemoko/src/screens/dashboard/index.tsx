import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Banknote, Boxes, CalendarClock, CheckCircle2, ChevronRight, Clock, PackageX, PhoneCall, ScanBarcode, ShoppingCart, Truck, Wrench, FilePlus2, PackagePlus,
} from 'lucide-react';
import { Badge, Button, Card, Empty, Section, Stat } from '@/ui/kit';
import { db } from '@/data/db';
import { byId, useCustomers, useLiveQuery, useProducts, useSettings, useStaff, useStock } from '@/data/hooks';
import { useSession } from '@/app/session';
import { lowStock } from '@/domain/stock';
import { JOB_STATUS } from '@/domain/jobs';
import { moneyShort } from '@/domain/util';
import type { PurchaseOrder, Role, Sale, WorkOrder } from '@/domain/types';
import { BarChart, Sparkline } from './charts';
import { JOB_TONE, addDays, deadStock, followUpsDue, overduePOs, salesByDay, salesByHour, startOfDay } from '../reports/calc';

const OPEN_STATES = ['checked_in', 'in_repair', 'waiting_parts', 'quality_check'];

const greeting = (h: number) => (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;

export default function Dashboard() {
  const nav = useNavigate();
  const { staff, role } = useSession();
  const settings = useSettings();
  const products = useProducts();
  const stock = useStock();
  const customers = useCustomers();
  const staffList = useStaff();

  const todayStart = startOfDay(new Date());
  const weekStartISO = addDays(todayStart, -6).toISOString();
  const sales = useLiveQuery(() => db.sales.where('createdAt').aboveOrEqual(weekStartISO).toArray(), [weekStartISO]) as Sale[] | undefined;
  const jobs = useLiveQuery(() => db.workOrders.toArray(), []) as WorkOrder[] | undefined;
  const pos = useLiveQuery(() => db.purchaseOrders.toArray(), []) as PurchaseOrder[] | undefined;
  const deadDays = settings?.deadStockDays ?? 60;
  const deadCutoff = new Date(Date.now() - deadDays * 86_400_000).toISOString();
  const recentMoves = useLiveQuery(() => db.movements.where('createdAt').aboveOrEqual(deadCutoff).toArray(), [deadCutoff]);

  const productMap = useMemo(() => byId(products), [products]);
  const staffMap = useMemo(() => byId(staffList), [staffList]);

  const d = useMemo(() => {
    const now = new Date();
    const allSales = sales ?? [];
    const allJobs = jobs ?? [];
    const todaysSales = allSales.filter((s) => !s.voided && new Date(s.createdAt) >= todayStart);
    const todayEnd = addDays(todayStart, 1);
    const todaysJobs = allJobs
      .filter((j) => j.status !== 'cancelled' && new Date(j.scheduledStart) >= todayStart && new Date(j.scheduledStart) < todayEnd)
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
    const low = lowStock(stock);
    const lowProducts = new Map<string, { productId: string; available: number; reorderPoint: number }>();
    for (const l of low) {
      const cur = lowProducts.get(l.productId);
      if (!cur || l.available < cur.available) lowProducts.set(l.productId, { productId: l.productId, available: l.available, reorderPoint: l.reorderPoint });
    }
    const lowList = [...lowProducts.values()].sort((a, b) => a.available / a.reorderPoint - b.available / b.reorderPoint);
    return {
      todaySales: todaysSales.reduce((s, x) => s + x.total, 0),
      todayCount: todaysSales.length,
      inProgress: allJobs.filter((j) => OPEN_STATES.includes(j.status)).length,
      ready: allJobs.filter((j) => j.status === 'ready').length,
      waiting: allJobs.filter((j) => j.status === 'waiting_parts'),
      todaysJobs,
      lowList,
      stockValue: stock.reduce((s, l) => s + l.quantity * (productMap.get(l.productId)?.cost ?? 0), 0),
      hours: salesByHour(todaysSales, settings?.openHour ?? 8, settings?.closeHour ?? 18),
      week: salesByDay(allSales, 7, now),
      overdue: overduePOs(pos ?? [], now),
      dead: deadStock(products, stock, recentMoves ?? [], deadDays, now),
      followUps: followUpsDue(customers, allJobs, settings?.followUpDays ?? 90, now),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, jobs, pos, stock, products, customers, recentMoves, settings, productMap]);

  const firstName = (staff?.name ?? 'there').split(/[\s(]/)[0] || 'there';
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const stockFocus = role === 'warehouse';
  const showCost = role === 'owner' || role === 'warehouse';

  const actions: { to: string; label: string; icon: typeof ShoppingCart; roles: Role[]; primary?: boolean }[] = [
    { to: '/pos', label: 'New sale', icon: ShoppingCart, roles: ['owner', 'cashier', 'advisor'] },
    { to: '/repairs/estimate/new', label: 'New estimate', icon: FilePlus2, roles: ['owner', 'cashier', 'advisor'] },
    { to: '/scan', label: 'Scan', icon: ScanBarcode, roles: ['owner', 'cashier', 'advisor', 'warehouse', 'mechanic'] },
    { to: '/purchasing', label: 'Receive delivery', icon: PackagePlus, roles: ['owner', 'warehouse'] },
  ];
  const visibleActions = actions.filter((a) => a.roles.includes(role)).sort((a, b) => (stockFocus ? Number(b.to === '/purchasing') - Number(a.to === '/purchasing') : 0));

  const tiles = {
    sales: <Stat key="sales" label="Today's sales" value={moneyShort(d.todaySales)} hint={`${d.todayCount} sale${d.todayCount === 1 ? '' : 's'}`} icon={<Banknote className="h-4 w-4" />} tone="ok" onClick={() => nav('/reports')} />,
    progress: <Stat key="progress" label="Repairs in progress" value={d.inProgress} hint="In the workshop now" icon={<Wrench className="h-4 w-4" />} tone="brand" onClick={() => nav('/repairs')} />,
    ready: <Stat key="ready" label="Ready for pickup" value={d.ready} hint={d.ready ? 'Let the customer know' : 'Nothing waiting'} icon={<CheckCircle2 className="h-4 w-4" />} tone="ok" onClick={() => nav('/repairs')} />,
    low: <Stat key="low" label="Low-stock items" value={d.lowList.length} hint={d.lowList.length ? 'At or below reorder point' : 'All stocked up'} icon={<PackageX className="h-4 w-4" />} tone={d.lowList.length ? 'warn' : 'neutral'} onClick={() => nav('/transfers')} />,
    value: <Stat key="value" label="Stock value" value={moneyShort(d.stockValue)} hint="At cost, both locations" icon={<Boxes className="h-4 w-4" />} tone="info" onClick={() => nav('/inventory')} />,
  };
  const order = stockFocus
    ? [tiles.low, tiles.value, tiles.ready, tiles.progress]
    : [tiles.sales, tiles.progress, tiles.ready, tiles.low, ...(showCost ? [tiles.value] : [])];

  const attention = (
    <Section title="Needs attention">
      <Card className="divide-y divide-line p-0">
        <AttnRow icon={<PackageX className="h-4 w-4" />} tone="warn" title="Low stock" to="/transfers" count={d.lowList.length}>
          {d.lowList.length === 0 ? (
            <span className="text-sm text-muted">Everything is above its reorder point.</span>
          ) : (
            <ul className="mt-1.5 space-y-1">
              {d.lowList.slice(0, 5).map((l) => (
                <li key={l.productId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{productMap.get(l.productId)?.name ?? 'Item'}</span>
                  <span className="num shrink-0 text-muted">{l.available} left</span>
                </li>
              ))}
            </ul>
          )}
        </AttnRow>
        {(role === 'owner' || role === 'warehouse') && (
          <AttnRow icon={<Truck className="h-4 w-4" />} tone={d.overdue.length ? 'bad' : 'neutral'} title="Overdue purchase orders" to="/purchasing" count={d.overdue.length}>
            <span className="text-sm text-muted">{d.overdue.length ? d.overdue.map((p) => p.poNo).slice(0, 4).join(', ') : 'Nothing is late.'}</span>
          </AttnRow>
        )}
        {(role === 'owner' || role === 'warehouse') && (
          <AttnRow icon={<Clock className="h-4 w-4" />} tone="neutral" title="Dead stock" to="/inventory" count={d.dead.length}>
            <span className="text-sm text-muted">
              {d.dead.length ? `Not sold for ${settings?.deadStockDays ?? 60} days. ${showCost ? `${moneyShort(d.dead.reduce((s, x) => s + x.value, 0))} tied up.` : ''}` : 'Everything has moved recently.'}
            </span>
          </AttnRow>
        )}
        {!stockFocus && (
          <AttnRow icon={<PhoneCall className="h-4 w-4" />} tone="info" title="Follow-ups due" to="/customers" count={d.followUps.length}>
            {d.followUps.length === 0 ? (
              <span className="text-sm text-muted">No one is due a check-in.</span>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {d.followUps.slice(0, 3).map((f) => (
                  <li key={f.customer.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{f.customer.name}</span>
                    <span className="num shrink-0 text-muted">{f.daysAgo} days ago</span>
                  </li>
                ))}
              </ul>
            )}
          </AttnRow>
        )}
      </Card>
    </Section>
  );

  const workshop = (
    <Section title="Workshop today" action={<Link to="/calendar" className="text-[13px] font-semibold text-brand">Open calendar</Link>}>
      {d.waiting.length > 0 && (
        <Link to={`/jobs/${d.waiting[0].id}`} className="mb-3 flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{d.waiting.length} job{d.waiting.length === 1 ? ' is' : 's are'} waiting for parts</div>
            <div className="truncate text-xs text-muted">{d.waiting.map((j) => j.jobNo).join(', ')}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      )}
      {d.todaysJobs.length === 0 ? (
        <Empty icon={<CalendarClock className="h-5 w-5" />} title="No jobs booked for today" sub="Book a bike in and it will show up here." action={<Button variant="soft" onClick={() => nav('/repairs/estimate/new')}>New estimate</Button>} />
      ) : (
        <Card className="divide-y divide-line p-0">
          {d.todaysJobs.map((j) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="flex min-h-[56px] items-center gap-3 px-4 py-3 transition hover:bg-raised">
              <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: staffMap.get(j.mechanicId ?? '')?.color ?? 'transparent' }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{j.jobNo}{' '}{j.complaint && <span className="font-normal text-muted">{j.complaint}</span>}</div>
                <div className="num text-xs text-muted">
                  {new Date(j.scheduledStart).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} · {staffMap.get(j.mechanicId ?? '')?.name ?? 'No mechanic yet'}
                </div>
              </div>
              <Badge tone={JOB_TONE[j.status]} dot>{JOB_STATUS[j.status].label}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </Section>
  );

  const charts = (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Today by hour</h3>
          <span className="num text-xs text-faint">{moneyShort(d.todaySales)}</span>
        </div>
        {d.todayCount === 0 ? (
          <div className="grid h-[150px] place-items-center text-sm text-muted">No sales yet today</div>
        ) : (
          <BarChart data={d.hours.map((h) => ({ label: hourLabel(h.hour), value: h.total }))} />
        )}
      </Card>
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Last 7 days</h3>
          <span className="num text-xs text-faint">{moneyShort(d.week.reduce((s, x) => s + x.total, 0))}</span>
        </div>
        <Sparkline values={d.week.map((x) => x.total)} height={96} />
        <div className="mt-2 flex justify-between text-[10px] text-faint">
          {d.week.map((x, i) => (
            <span key={i}>{x.day.toLocaleDateString('en-PH', { weekday: 'short' }).slice(0, 3)}</span>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">{today}</p>
        <h1 className="mt-0.5 text-[28px] font-bold md:text-[34px]">{greeting(new Date().getHours())}, {firstName}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {visibleActions.map((a, i) => (
          <Button key={a.to} variant={i === 0 ? 'primary' : 'secondary'} size="lg" icon={<a.icon className="h-5 w-5" />} onClick={() => nav(a.to)} className="min-h-[52px]">
            {a.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{order}</div>

      {stockFocus ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {attention}
          <div className="space-y-6">
            {workshop}
            {charts}
          </div>
        </div>
      ) : (
        <>
          {charts}
          <div className="grid gap-6 lg:grid-cols-2">
            {workshop}
            {attention}
          </div>
        </>
      )}
    </div>
  );
}

function AttnRow({ icon, tone, title, count, to, children }: { icon: React.ReactNode; tone: 'warn' | 'bad' | 'info' | 'neutral'; title: string; count: number; to: string; children: React.ReactNode }) {
  const toneCls = { warn: 'bg-warn/12 text-warn', bad: 'bg-bad/12 text-bad', info: 'bg-info/12 text-info', neutral: 'bg-raised text-muted' }[tone];
  return (
    <Link to={to} className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-raised">
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneCls}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span className="num font-display text-lg font-bold">{count}</span>
        </div>
        {children}
      </div>
    </Link>
  );
}
