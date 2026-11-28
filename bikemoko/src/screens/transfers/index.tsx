import { useMemo, useState } from 'react';
import { ArrowLeftRight, ArrowRight, CheckCircle2, Printer } from 'lucide-react';
import { db } from '@/data/db';
import { transferMany, transferStock } from '@/data/actions';
import { byId, useLiveQuery, useProducts, useStock } from '@/data/hooks';
import { available, levelId, lowStock, replenishmentPickList, type LowStockRow } from '@/domain/stock';
import type { LocationCode } from '@/domain/types';
import { useSession } from '@/app/session';
import { Badge, Button, Card, Empty, Field, PageHeader, SearchBox, Section, Select, Stepper, cx, run, toast } from '@/ui/kit';
import { esc, printHtml } from '../purchasing/print';

const LOC: Record<LocationCode, string> = { STORE: 'Store', WAREHOUSE: 'Warehouse' };

export default function Transfers() {
  const stock = useStock();
  const products = useProducts();
  const pById = useMemo(() => byId(products), [products]);
  const low = useMemo(() => lowStock(stock), [stock]);
  return (
    <div>
      <PageHeader title="Transfers & Alerts" sub="Keep the shop floor stocked from the warehouse" icon={<ArrowLeftRight className="h-5 w-5" />} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <PickList />
          <Section title="Low-stock alerts">
            {low.length ? (
              <div className="space-y-4">
                {(['STORE', 'WAREHOUSE'] as LocationCode[]).map((loc) => (
                  <AlertGroup key={loc} loc={loc} rows={low.filter((l) => l.location === loc)} names={(id) => pById.get(id)?.name ?? 'Item'} />
                ))}
              </div>
            ) : (
              <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="No low-stock alerts" sub="Everything is above its reorder point." />
            )}
          </Section>
        </div>
        <div className="space-y-5">
          <ManualTransfer />
          <Recent />
        </div>
      </div>
    </div>
  );
}

function AlertGroup({ loc, rows, names }: { loc: LocationCode; rows: LowStockRow[]; names: (id: string) => string }) {
  if (!rows.length) return null;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{LOC[loc]}</h3>
        <Badge tone="warn">{rows.length} low</Badge>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const pct = Math.min(100, Math.round((Math.max(0, r.available) / Math.max(1, r.reorderPoint * 2)) * 100));
          const out = r.available <= 0;
          return (
            <div key={r.productId}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{names(r.productId)}</span>
                <span className="num whitespace-nowrap text-muted">
                  {r.available} of {r.reorderPoint}
                </span>
              </div>
              <div className="relative mt-1.5 h-2 rounded-full bg-raised">
                <div className={cx('h-full rounded-full', out ? 'bg-bad' : 'bg-warn')} style={{ width: `${pct}%` }} />
                <div className="absolute inset-y-[-3px] w-0.5 bg-ink/60" style={{ left: '50%' }} title="Reorder point" />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PickList() {
  const stock = useStock();
  const products = useProducts();
  const { staff } = useSession();
  const pById = useMemo(() => byId(products), [products]);
  const rows = useMemo(() => replenishmentPickList(stock), [stock]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [off, setOff] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const bin = (id: string) => stock.find((s) => s.id === levelId(id, 'WAREHOUSE'))?.bin || 'No bin';
  const chosen = rows
    .filter((r) => !off.has(r.productId))
    .map((r) => ({ productId: r.productId, qty: Math.min(qtys[r.productId] ?? r.qty, r.warehouseAvailable) }))
    .filter((r) => r.qty > 0);

  const print = () => {
    try {
      const body = chosen
        .map((r) => `<tr><td>${esc(bin(r.productId))}</td><td>${esc(pById.get(r.productId)?.name ?? 'Item')}</td><td class="r">${r.qty}</td><td>[ ]</td></tr>`)
        .join('');
      printHtml('Pick-list', `<h1>Replenishment pick-list</h1><p>Warehouse to Store, ${new Date().toISOString().slice(0, 10)}</p><table><tr><th>Bin</th><th>Item</th><th class="r">Qty</th><th>Picked</th></tr>${body}</table>`);
    } catch (e) {
      toast.error(e);
    }
  };
  const confirm = async () => {
    setBusy(true);
    const ok = await run(() => transferMany(chosen, staff?.id), `${chosen.length} item${chosen.length === 1 ? '' : 's'} moved to the store`);
    setBusy(false);
    void ok;
    setQtys({});
    setOff(new Set());
  };

  return (
    <Section title="Replenishment pick-list">
      <Card>
        {rows.length ? (
          <>
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.productId} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-raised p-3">
                  <input
                    type="checkbox"
                    aria-label="Include"
                    className="h-5 w-5 accent-brand"
                    checked={!off.has(r.productId)}
                    onChange={() =>
                      setOff((s) => {
                        const n = new Set(s);
                        if (n.has(r.productId)) n.delete(r.productId);
                        else n.add(r.productId);
                        return n;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{pById.get(r.productId)?.name ?? 'Item'}</div>
                    <div className="num text-xs text-muted">
                      Bin {bin(r.productId)}. Store {r.storeAvailable}, warehouse {r.warehouseAvailable}
                    </div>
                  </div>
                  <Stepper value={Math.min(qtys[r.productId] ?? r.qty, r.warehouseAvailable)} min={0} max={r.warehouseAvailable} onChange={(n) => setQtys((q) => ({ ...q, [r.productId]: n }))} />
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={<Printer className="h-4 w-4" />} disabled={!chosen.length} onClick={print}>Print pick-list</Button>
              <Button variant="primary" icon={<ArrowRight className="h-4 w-4" />} disabled={!chosen.length} loading={busy} onClick={confirm}>
                Confirm transfer
              </Button>
            </div>
          </>
        ) : (
          <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="All stocked up" sub="Nothing in the store needs refilling from the warehouse right now." />
        )}
      </Card>
    </Section>
  );
}

function ManualTransfer() {
  const products = useProducts();
  const stock = useStock();
  const { staff } = useSession();
  const [q, setQ] = useState('');
  const [productId, setProductId] = useState('');
  const [from, setFrom] = useState<LocationCode>('WAREHOUSE');
  const [qty, setQty] = useState(1);
  const to: LocationCode = from === 'STORE' ? 'WAREHOUSE' : 'STORE';
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => p.active && (!t || p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.barcode.includes(t))).slice(0, 50);
  }, [products, q]);
  const avail = productId ? available(stock.find((s) => s.id === levelId(productId, from))) : 0;

  return (
    <Section title="Manual transfer">
      <Card className="space-y-3">
        <Field label="Product">
          <SearchBox value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder="Search name, SKU or barcode" />
        </Field>
        <Select aria-label="Choose product" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Choose a product</option>
          {matches.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Select value={from} onChange={(e) => setFrom(e.target.value as LocationCode)}>
              <option value="WAREHOUSE">Warehouse</option>
              <option value="STORE">Store</option>
            </Select>
          </Field>
          <Field label="To">
            <Select value={to} disabled>
              <option>{LOC[to]}</option>
            </Select>
          </Field>
        </div>
        <Field label="Quantity" hint={productId ? `${avail} available in ${LOC[from].toLowerCase()}` : undefined}>
          <Stepper value={qty} min={1} max={Math.max(1, avail)} onChange={setQty} />
        </Field>
        <Button
          variant="primary"
          block
          disabled={!productId || avail < qty}
          onClick={async () => {
            await run(() => transferStock(productId, from, to, qty, staff?.id), 'Transfer done');
            setQty(1);
          }}
        >
          Transfer
        </Button>
      </Card>
    </Section>
  );
}

function Recent() {
  const products = useProducts();
  const pById = useMemo(() => byId(products), [products]);
  const moves = useLiveQuery(async () => (await db.movements.where('reason').equals('transfer').toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30), [], []);
  return (
    <Section title="Recent transfers">
      {moves.length ? (
        <Card pad={false} className="divide-y divide-line">
          {moves.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{pById.get(m.productId)?.name ?? 'Item'}</div>
                <div className="text-xs text-muted">
                  {m.from ? LOC[m.from] : '-'} to {m.to ? LOC[m.to] : '-'}, {m.createdAt.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
              <span className="num font-bold">{m.qty}</span>
            </div>
          ))}
        </Card>
      ) : (
        <Empty title="No transfers yet" sub="Moves between the warehouse and store show up here." />
      )}
    </Section>
  );
}
