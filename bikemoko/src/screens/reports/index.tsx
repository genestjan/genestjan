import { useMemo, useState } from 'react';
import { BarChart3, Download, Lock } from 'lucide-react';
import { Button, Card, Empty, Money, PageHeader, Section, Segmented, Stat, Table } from '@/ui/kit';
import { db } from '@/data/db';
import { byId, useLiveQuery, useProducts, useSettings, useStaff, useStock, useSuppliers } from '@/data/hooks';
import { useSession } from '@/app/session';
import { minsLabel, moneyShort } from '@/domain/util';
import type { PayMethod, PurchaseOrder, Sale, StockMovement, WorkOrder } from '@/domain/types';
import { Meter } from '../dashboard/charts';
import { downloadText } from '../settings/files';
import { toCsv } from '../settings/csv';
import { deadStock, mechanicProductivity, rangeFor, summariseSales, supplierPerformance, topProducts, type RangeKey } from './calc';

const METHOD: Record<PayMethod, string> = { cash: 'Cash', gcash: 'GCash', maya: 'Maya', bank: 'Bank transfer', card: 'Card' };
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function Reports() {
  const { role } = useSession();
  if (role !== 'owner') {
    return <Empty icon={<Lock className="h-5 w-5" />} title="Reports are for the owner" sub="Switch to the owner profile to see sales and margins." />;
  }
  return <OwnerReports />;
}

function OwnerReports() {
  const [key, setKey] = useState<RangeKey>('7d');
  const { from, to } = useMemo(() => rangeFor(key), [key]);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const settings = useSettings();
  const products = useProducts();
  const stock = useStock();
  const staff = useStaff();
  const suppliers = useSuppliers();
  const deadDays = settings?.deadStockDays ?? 60;
  const deadCutoff = new Date(Date.now() - deadDays * 86_400_000).toISOString();

  const sales = (useLiveQuery(() => db.sales.where('createdAt').between(fromISO, toISO, true, false).toArray(), [fromISO, toISO]) ?? []) as Sale[];
  const jobs = (useLiveQuery(() => db.workOrders.where('status').equals('completed').toArray(), []) ?? []) as WorkOrder[];
  const pos = (useLiveQuery(() => db.purchaseOrders.toArray(), []) ?? []) as PurchaseOrder[];
  const recent = (useLiveQuery(() => db.movements.where('createdAt').aboveOrEqual(deadCutoff).toArray(), [deadCutoff]) ?? []) as StockMovement[];

  const pmap = useMemo(() => byId(products), [products]);
  const smap = useMemo(() => byId(staff), [staff]);
  const sum = useMemo(() => summariseSales(sales, pmap), [sales, pmap]);
  const top = useMemo(() => topProducts(sales, pmap), [sales, pmap]);
  const dead = useMemo(() => deadStock(products, stock, recent, deadDays), [products, stock, recent, deadDays]);
  const mech = useMemo(() => mechanicProductivity(jobs, from, to), [jobs, from, to]);
  const sup = useMemo(() => supplierPerformance(suppliers, pos, from, to), [suppliers, pos, from, to]);

  const methodTotal = Object.values(sum.byMethod).reduce((a, b) => a + b, 0);
  const split = sum.parts + sum.labor;
  const stamp = new Date().toISOString().slice(0, 10);

  const exportSales = () => {
    const rows: (string | number)[][] = [['receipt', 'date', 'items', 'subtotal', 'discount', 'total', 'payments', 'voided']];
    for (const s of sales) {
      rows.push([s.receiptNo, s.createdAt, s.lines.reduce((n, l) => n + l.qty, 0), s.subtotal / 100, s.discount / 100, s.total / 100, s.payments.map((p) => `${p.method} ${p.amount / 100}`).join('; '), s.voided ? 'yes' : 'no']);
    }
    downloadText(`bikemoko-sales-${stamp}.csv`, toCsv(rows), 'text/csv');
  };
  const exportStock = () => {
    const qty = new Map<string, { s: number; w: number }>();
    for (const l of stock) {
      const e = qty.get(l.productId) ?? { s: 0, w: 0 };
      if (l.location === 'STORE') e.s = l.quantity;
      else e.w = l.quantity;
      qty.set(l.productId, e);
    }
    const rows: (string | number)[][] = [['sku', 'barcode', 'name', 'category', 'brand', 'cost', 'price', 'store_qty', 'warehouse_qty', 'value_at_cost']];
    for (const p of products) {
      const q = qty.get(p.id) ?? { s: 0, w: 0 };
      rows.push([p.sku, p.barcode, p.name, p.category, p.brand, p.cost / 100, p.price / 100, q.s, q.w, ((q.s + q.w) * p.cost) / 100]);
    }
    downloadText(`bikemoko-stock-${stamp}.csv`, toCsv(rows), 'text/csv');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Reports"
        sub={`${from.toLocaleDateString('en-PH', { day: 'numeric', month: 'short' })} to ${new Date(to.getTime() - 1).toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        actions={
          <>
            <Button icon={<Download className="h-4 w-4" />} onClick={exportSales}>Sales CSV</Button>
            <Button icon={<Download className="h-4 w-4" />} onClick={exportStock}>Stock CSV</Button>
          </>
        }
      />
      <div className="overflow-x-auto">
        <Segmented<RangeKey>
          value={key}
          onChange={setKey}
          options={[{ value: 'today', label: 'Today' }, { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'month', label: 'This month' }]}
        />
      </div>

      <Section title="Sales summary">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Net sales" value={moneyShort(sum.net)} hint={`${sum.count} sale${sum.count === 1 ? '' : 's'}`} />
          <Stat label="Gross" value={moneyShort(sum.gross)} hint="Before discounts" />
          <Stat label="Discounts" value={moneyShort(sum.discounts)} />
          <Stat label="Average ticket" value={moneyShort(sum.avgTicket)} />
          <Stat label="Gross margin" value={moneyShort(sum.margin)} hint={sum.net ? `${pct(sum.marginPct)} of net, parts at cost` : undefined} tone="ok" />
          <Stat label="Cost of parts" value={moneyShort(sum.cost)} />
        </div>
        {sum.count === 0 && <p className="mt-3 text-sm text-muted">No sales in this period yet.</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold">By payment method</h3>
            <div className="space-y-3">
              {(Object.keys(METHOD) as PayMethod[]).map((m) => (
                <div key={m}>
                  <div className="mb-1 flex justify-between text-sm"><span>{METHOD[m]}</span><Money value={sum.byMethod[m]} /></div>
                  <Meter value={methodTotal ? sum.byMethod[m] / methodTotal : 0} />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold">Parts and labour</h3>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-sm"><span>Parts</span><span className="num">{moneyShort(sum.parts)} · {split ? pct(sum.parts / split) : '0%'}</span></div>
                <Meter value={split ? sum.parts / split : 0} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm"><span>Labour</span><span className="num">{moneyShort(sum.labor)} · {split ? pct(sum.labor / split) : '0%'}</span></div>
                <Meter value={split ? sum.labor / split : 0} tone="ok" />
              </div>
              <p className="text-xs text-faint">Before discounts. Margin counts parts at their cost price; labour has no cost.</p>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Top products">
        <Table
          rows={top}
          rowKey={(r) => r.productId}
          empty={<Empty title="No product sales in this period" />}
          cols={[
            { key: 'n', label: 'Product', cell: (r) => <span className="font-semibold">{r.name}</span> },
            { key: 'q', label: 'Sold', align: 'right', cell: (r) => r.qty },
            { key: 'r', label: 'Revenue', align: 'right', cell: (r) => <Money value={r.revenue} /> },
            { key: 'm', label: 'Margin', align: 'right', cell: (r) => <Money value={r.margin} /> },
          ]}
        />
      </Section>

      <Section title={`Dead stock (no sales in ${deadDays} days)`}>
        <p className="mb-2 text-sm text-muted">
          <span className="num font-semibold text-ink">{moneyShort(dead.reduce((s, r) => s + r.value, 0))}</span> tied up in {dead.length} item{dead.length === 1 ? '' : 's'}. This list does not change with the date range.
        </p>
        <Table
          rows={dead.slice(0, 15)}
          rowKey={(r) => r.productId}
          empty={<Empty title="Nothing is gathering dust" sub="Every item with stock has sold or been used recently." />}
          cols={[
            { key: 'n', label: 'Product', cell: (r) => <span className="font-semibold">{r.name}</span> },
            { key: 'q', label: 'On hand', align: 'right', cell: (r) => r.qty },
            { key: 'v', label: 'Tied up', align: 'right', cell: (r) => <Money value={r.value} /> },
          ]}
        />
      </Section>

      <Section title="Mechanic productivity">
        <Table
          rows={mech}
          rowKey={(r) => r.mechanicId}
          empty={<Empty title="No completed jobs in this period" />}
          cols={[
            { key: 'n', label: 'Mechanic', cell: (r) => <span className="font-semibold">{smap.get(r.mechanicId)?.name ?? 'Unknown'}</span> },
            { key: 'j', label: 'Jobs done', align: 'right', cell: (r) => r.jobs },
            { key: 'l', label: 'Labour billed', align: 'right', cell: (r) => <Money value={r.labor} /> },
            { key: 'w', label: 'Worked', align: 'right', cell: (r) => minsLabel(r.workedMins) },
            { key: 'e', label: 'Estimated', align: 'right', cell: (r) => minsLabel(r.estimatedMins) },
          ]}
        />
      </Section>

      <Section title="Supplier performance">
        <Table
          rows={sup}
          rowKey={(r) => r.supplier.id}
          empty={<Empty title="No suppliers yet" />}
          cols={[
            { key: 'n', label: 'Supplier', cell: (r) => <span className="font-semibold">{r.supplier.name}</span> },
            { key: 'r', label: 'On time', align: 'right', cell: (r) => pct(r.supplier.reliability) },
            { key: 'l', label: 'Avg lead', align: 'right', cell: (r) => `${r.supplier.avgLeadDays} day${r.supplier.avgLeadDays === 1 ? '' : 's'}` },
            { key: 'o', label: 'Orders', align: 'right', cell: (r) => r.orders },
            { key: 'd', label: 'Received', align: 'right', cell: (r) => r.received },
          ]}
        />
      </Section>
    </div>
  );
}
