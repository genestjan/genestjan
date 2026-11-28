import { useMemo, useState } from 'react';
import { Check, Copy, PackageCheck, Printer, Send, ShoppingCart, Truck, X } from 'lucide-react';
import { db } from '@/data/db';
import { createPO, receivePO, setPOStatus } from '@/data/actions';
import { byId, useLiveQuery, useProducts, useStock, useSuppliers, useSettings } from '@/data/hooks';
import { compareSuppliers, pickSupplier, poTotal, type POMode } from '@/domain/po';
import { needsReorder } from '@/domain/stock';
import { money } from '@/domain/util';
import type { PurchaseOrder } from '@/domain/types';
import { useSession } from '@/app/session';
import { Badge, Button, Card, Drawer, Empty, Modal, PageHeader, Segmented, Stat, Stepper, Table, cx, run, toast, Money, type Tone } from '@/ui/kit';
import { groupBySupplier, isOverdue, mergeReorder, outstanding, poText } from './helpers';
import { esc, printHtml } from './print';

const STATUS_TONE: Record<PurchaseOrder['status'], Tone> = { draft: 'neutral', sent: 'info', partial: 'warn', received: 'ok', cancelled: 'bad' };
const MODES: { value: POMode; label: string }[] = [
  { value: 'cheapest', label: 'Lowest cost' },
  { value: 'fastest', label: 'Fastest delivery' },
  { value: 'best', label: 'Best value' },
];

export default function Purchasing() {
  const [tab, setTab] = useState<'reorder' | 'pos'>('reorder');
  return (
    <div>
      <PageHeader
        title="Smart POs"
        sub="Compare suppliers and order what the shop needs"
        icon={<ShoppingCart className="h-5 w-5" />}
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'reorder', label: 'Needs reorder' },
              { value: 'pos', label: 'Purchase orders' },
            ]}
          />
        }
      />
      {tab === 'reorder' ? <Reorder onCreated={() => setTab('pos')} /> : <POList />}
    </div>
  );
}

// ---------- Needs reorder ----------

function Reorder({ onCreated }: { onCreated: () => void }) {
  const stock = useStock();
  const products = useProducts();
  const suppliers = useSuppliers();
  const offers = useLiveQuery(() => db.supplierProducts.toArray(), [], []);
  const waiting = useLiveQuery(() => db.workOrders.where('status').equals('waiting_parts').toArray(), [], []);
  const [mode, setMode] = useState<POMode>('best');
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const pById = useMemo(() => byId(products), [products]);
  const sById = useMemo(() => byId(suppliers), [suppliers]);
  const items = useMemo(() => mergeReorder(needsReorder(stock), waiting), [stock, waiting]);

  const rows = items
    .filter((i) => pById.has(i.productId))
    .map((i) => {
      const qty = qtys[i.productId] ?? i.qty;
      const options = compareSuppliers(qty, offers.filter((o) => o.productId === i.productId), sById);
      const chosenId = overrides[i.productId] ?? pickSupplier(options, mode)?.supplierId;
      const chosen = options.find((o) => o.supplierId === chosenId);
      return { ...i, qty, options, chosen };
    });

  const picks = rows.filter((r) => r.chosen && !skipped.has(r.productId)).map((r) => ({ productId: r.productId, option: r.chosen! }));
  const groups = groupBySupplier(picks);
  const total = picks.reduce((s, p) => s + p.option.lineTotal, 0);

  const changeMode = (m: POMode) => {
    setMode(m);
    setOverrides({});
  };

  const create = async () => {
    setBusy(true);
    const ok = await run(async () => {
      for (const g of groups) await createPO(g.supplierId, g.items, g.leadDays);
      return true;
    }, groups.length === 1 ? 'PO created' : `${groups.length} POs created`);
    setBusy(false);
    if (ok) {
      setSkipped(new Set());
      setOverrides({});
      setQtys({});
      onCreated();
    }
  };

  if (!rows.length) return <Empty icon={<PackageCheck className="h-6 w-6" />} title="Nothing to reorder" sub="Stock is healthy and no repair jobs are waiting on parts." />;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted">Optimize for</span>
        <Segmented value={mode} onChange={changeMode} options={MODES} />
      </div>
      {rows.map((r) => {
        const p = pById.get(r.productId)!;
        const skip = skipped.has(r.productId);
        return (
          <Card key={r.productId} className={cx(skip && 'opacity-60')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{p.name}</div>
                <div className="num text-xs text-faint">{p.sku}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.reasons.map((c) => (
                    <Badge key={c} tone={c === 'Low stock' ? 'warn' : 'info'}>{c}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Stepper value={r.qty} min={1} onChange={(n) => setQtys((q) => ({ ...q, [r.productId]: n }))} />
                <label className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand"
                    checked={!skip}
                    disabled={!r.options.length}
                    onChange={() =>
                      setSkipped((s) => {
                        const n = new Set(s);
                        if (n.has(r.productId)) n.delete(r.productId);
                        else n.add(r.productId);
                        return n;
                      })
                    }
                  />
                  Order
                </label>
              </div>
            </div>
            {r.options.length ? (
              <div className="mt-3 overflow-x-auto">
                <div className="min-w-[640px] space-y-1.5">
                  {r.options.map((o) => {
                    const sel = o.supplierId === r.chosen?.supplierId;
                    return (
                      <button
                        key={o.supplierId}
                        type="button"
                        onClick={() => setOverrides((x) => ({ ...x, [r.productId]: o.supplierId }))}
                        className={cx('grid w-full min-h-[44px] grid-cols-[1.4fr_1fr_.7fr_.6fr_.8fr_1fr_.5fr] items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition', sel ? 'border-brand bg-brand-soft' : 'border-line bg-raised hover:border-faint/40')}
                      >
                        <span>
                          <span className="flex items-center gap-1.5 font-semibold">
                            {sel && <Check className="h-4 w-4 text-brand" />}
                            {o.supplierName}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {o.badges.map((b) => (
                              <Badge key={b} tone={b === 'Best value' ? 'brand' : 'ok'} className="!px-2 !py-0 !text-[11px]">{b}</Badge>
                            ))}
                          </span>
                        </span>
                        <span className="num">{money(o.unitCost)}<span className="block text-xs text-faint">unit cost</span></span>
                        <span className="num">{o.leadDays} d<span className="block text-xs text-faint">lead</span></span>
                        <span className="num">{o.moq}<span className="block text-xs text-faint">MOQ</span></span>
                        <span className="num">{Math.round(o.reliability * 100)}%<span className="block text-xs text-faint">reliable</span></span>
                        <span className="num font-semibold">{money(o.lineTotal)}<span className="block text-xs font-normal text-faint">{o.orderQty} pcs</span></span>
                        <span className="num text-right font-bold">{o.score}<span className="block text-xs font-normal text-faint">score</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-raised px-3 py-3 text-sm text-muted">No supplier price yet. Add this product to a supplier price list in Suppliers.</p>
            )}
          </Card>
        );
      })}
      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 shadow-pop">
          <div className="text-sm">
            <span className="num font-bold">{picks.length}</span> items, <span className="num font-bold">{groups.length}</span> supplier{groups.length === 1 ? '' : 's'},{' '}
            <Money value={total} strong />
          </div>
          <Button variant="primary" size="lg" icon={<Truck className="h-4 w-4" />} disabled={!picks.length} loading={busy} onClick={create}>
            Create POs
          </Button>
        </Card>
      </div>
    </div>
  );
}

// ---------- Purchase orders ----------

function POList() {
  const pos = useLiveQuery(() => db.purchaseOrders.toArray(), [], []);
  const suppliers = useSuppliers();
  const [openId, setOpenId] = useState<string | null>(null);
  const sById = useMemo(() => byId(suppliers), [suppliers]);
  const sorted = useMemo(() => [...pos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [pos]);
  const open = pos.find((p) => p.id === openId) ?? null;
  const overdue = pos.filter((p) => isOverdue(p)).length;
  const active = pos.filter((p) => ['draft', 'sent', 'partial'].includes(p.status));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Open POs" value={active.length} />
        <Stat label="On order" value={<Money value={active.reduce((s, p) => s + poTotal(p), 0)} />} />
        <Stat label="Overdue" value={overdue} tone={overdue ? 'bad' : undefined} />
      </div>
      <Table
        rows={sorted}
        rowKey={(p) => p.id}
        onRow={(p) => setOpenId(p.id)}
        empty={<Empty icon={<ShoppingCart className="h-6 w-6" />} title="No purchase orders yet" sub="Create one from the Needs reorder tab." />}
        cols={[
          { key: 'no', label: 'PO', cell: (p) => <span className="num font-semibold">{p.poNo}</span> },
          { key: 's', label: 'Supplier', cell: (p) => sById.get(p.supplierId)?.name ?? 'Unknown' },
          { key: 'st', label: 'Status', cell: (p) => <Badge tone={STATUS_TONE[p.status]} dot>{p.status}</Badge> },
          { key: 'i', label: 'Items', align: 'right', cell: (p) => p.items.length },
          { key: 't', label: 'Total', align: 'right', cell: (p) => money(poTotal(p)) },
          {
            key: 'e',
            label: 'Expected',
            cell: (p) => (
              <span className={cx('num', isOverdue(p) && 'font-semibold text-bad')}>
                {p.expectedDate ? p.expectedDate.slice(0, 10) : 'None'}
                {isOverdue(p) && ' (late)'}
              </span>
            ),
          },
        ]}
      />
      {open && <PODrawer po={open} supplierName={sById.get(open.supplierId)?.name} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PODrawer({ po, supplierName, onClose }: { po: PurchaseOrder; supplierName?: string; onClose: () => void }) {
  const { staff } = useSession();
  const products = useProducts();
  const suppliers = useSuppliers();
  const settings = useSettings();
  const pById = useMemo(() => byId(products), [products]);
  const [recv, setRecv] = useState<Record<string, number>>({});
  const [confirmCancel, setConfirmCancel] = useState(false);
  const canReceive = po.status === 'sent' || po.status === 'partial';
  const qtyFor = (productId: string, out: number) => recv[productId] ?? out;

  const text = () => poText(po, suppliers.find((s) => s.id === po.supplierId), pById, settings?.shopName ?? 'Bikemoko', money);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      toast.ok('PO text copied');
    } catch {
      toast.bad('Could not copy. Select the text and copy by hand.');
    }
  };
  const print = () => {
    try {
      const rows = po.items
        .map((i) => `<tr><td>${esc(pById.get(i.productId)?.name ?? 'Item')}</td><td class="r">${i.qty}</td><td class="r">${esc(money(i.unitCost))}</td><td class="r">${esc(money(i.qty * i.unitCost))}</td></tr>`)
        .join('');
      printHtml(po.poNo, `<h1>Purchase order ${esc(po.poNo)}</h1><p>${esc(settings?.shopName ?? 'Bikemoko')} to ${esc(supplierName ?? 'Supplier')}${po.expectedDate ? `, needed by ${po.expectedDate.slice(0, 10)}` : ''}</p><table><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr>${rows}<tr><th colspan="3" class="r">Total</th><th class="r">${esc(money(poTotal(po)))}</th></tr></table>${po.notes ? `<p>${esc(po.notes)}</p>` : ''}`);
    } catch (e) {
      toast.error(e);
    }
  };
  const receive = async () => {
    const list = po.items.map((i) => ({ productId: i.productId, qty: Math.min(qtyFor(i.productId, outstanding(i)), outstanding(i)) })).filter((r) => r.qty > 0);
    if (!list.length) return toast.bad('Enter a quantity to receive');
    const r = await run(() => receivePO(po.id, list, staff?.id), 'Delivery received');
    if (r) setRecv({});
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={po.poNo}
        sub={
          <span className="flex items-center gap-2">
            {supplierName ?? 'Unknown supplier'} <Badge tone={STATUS_TONE[po.status]} dot>{po.status}</Badge>
          </span>
        }
        footer={
          <>
            {po.status === 'draft' && (
              <Button variant="primary" block icon={<Send className="h-4 w-4" />} onClick={() => run(() => setPOStatus(po.id, 'sent'), 'Marked as sent')}>
                Mark as sent
              </Button>
            )}
            {canReceive && (
              <Button variant="primary" block icon={<PackageCheck className="h-4 w-4" />} onClick={receive}>
                Receive delivery
              </Button>
            )}
            {(po.status === 'draft' || po.status === 'sent') && (
              <Button variant="danger" icon={<X className="h-4 w-4" />} onClick={() => setConfirmCancel(true)}>
                Cancel PO
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {po.items.map((i) => {
              const p = pById.get(i.productId);
              const out = outstanding(i);
              return (
                <div key={i.productId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised p-3">
                  <div className="min-w-0">
                    <div className="font-medium">{p?.name ?? 'Item'}</div>
                    <div className="num text-xs text-muted">
                      {i.qty} x {money(i.unitCost)} = {money(i.qty * i.unitCost)}, received {i.receivedQty}
                    </div>
                  </div>
                  {canReceive && out > 0 && <Stepper value={qtyFor(i.productId, out)} min={0} max={out} onChange={(n) => setRecv((r) => ({ ...r, [i.productId]: n }))} />}
                  {canReceive && out === 0 && <Badge tone="ok">Complete</Badge>}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Total</span>
            <Money value={poTotal(po)} strong />
          </div>
          {po.expectedDate && (
            <div className={cx('text-sm', isOverdue(po) ? 'font-semibold text-bad' : 'text-muted')}>
              Expected {po.expectedDate.slice(0, 10)}
              {isOverdue(po) && ', overdue'}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button icon={<Copy className="h-4 w-4" />} onClick={copy}>Copy PO text</Button>
            <Button icon={<Printer className="h-4 w-4" />} onClick={print}>Print PO</Button>
          </div>
          <pre className="whitespace-pre-wrap rounded-xl border border-line bg-raised p-3 text-xs text-muted">{text()}</pre>
        </div>
      </Drawer>
      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this PO?"
        footer={
          <>
            <Button block onClick={() => setConfirmCancel(false)}>Keep it</Button>
            <Button
              variant="danger"
              block
              onClick={async () => {
                await run(() => setPOStatus(po.id, 'cancelled'), 'PO cancelled');
                setConfirmCancel(false);
              }}
            >
              Yes, cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{po.poNo} will be marked as cancelled. This cannot be undone.</p>
      </Modal>
    </>
  );
}
