import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Clock, Minus, Printer, ScanBarcode, ShoppingCart, Trash2, UserRound, Wrench, X } from 'lucide-react';
import { Badge, Button, Empty, IconButton, Input, Kbd, Modal, Money, Segmented, SearchBox, Stepper, run, toast, cx } from '@/ui/kit';
import { db } from '@/data/db';
import { completeRepairBilling, recordSale } from '@/data/actions';
import { useCustomers, useLiveQuery, useProducts, useSettings, useStaff, useStock } from '@/data/hooks';
import { useSession } from '@/app/session';
import { applyDiscount } from '@/domain/payments';
import { jobTotals } from '@/domain/jobs';
import { StockError } from '@/domain/stock';
import type { Customer, Payment, Product, Sale, WorkOrder } from '@/domain/types';
import { billTotals, findByCode, matchesQuery, storeAvailable } from './helpers';
import { PayModal } from './PayModal';
import { ShiftPanel } from './ShiftPanel';
import { Receipt, type ReceiptSize } from './Receipt';


interface CartLine {
  productId: string;
  qty: number;
  serial: string;
}
type Discount = { type: 'amount' | 'percent'; value: number };
interface Confirm {
  title: string;
  text: string;
  yes: string;
  go: () => void;
}

const SIZE_KEY = 'bm.receiptSize';
const readSize = (): ReceiptSize => {
  try {
    const v = localStorage.getItem(SIZE_KEY);
    return v === '58' || v === '80' || v === 'a4' ? v : '80';
  } catch {
    return '80';
  }
};

export default function Screen() {
  const { staff, shift } = useSession();
  const products = useProducts();
  const stock = useStock();
  const customers = useCustomers();
  const staffList = useStaff();
  const settings = useSettings();
  const readyJobs = useLiveQuery(() => db.workOrders.where('status').equals('ready').toArray(), []) ?? [];
  const bikes = useLiveQuery(() => db.bikes.toArray(), []) ?? [];
  const [params, setParams] = useSearchParams();

  const [tab, setTab] = useState<'products' | 'repairs'>('products');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [repair, setRepair] = useState<WorkOrder | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [discount, setDiscount] = useState<Discount>({ type: 'amount', value: 0 });
  const [payOpen, setPayOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [size, setSizeState] = useState<ReceiptSize>(readSize);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const byProduct = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const levels = useMemo(() => new Map(stock.map((s) => [s.id, s])), [stock]);
  const avail = useCallback((p: Product) => storeAvailable(p, byProduct, levels), [byProduct, levels]);
  const customer = customers.find((c) => c.id === (repair?.customerId ?? customerId)) ?? null;

  const focusSearch = useCallback(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  // ---- cart maths ----
  const subtotal = repair ? jobTotals(repair.lines).total : cart.reduce((s, l) => s + l.qty * (byProduct.get(l.productId)?.price ?? 0), 0);
  const discountC = applyDiscount(subtotal, discount);
  const { total, due } = billTotals(subtotal, discountC, repair?.deposit ?? 0);
  const count = repair ? repair.lines.length : cart.reduce((s, l) => s + l.qty, 0);
  const hasItems = repair ? true : cart.length > 0;

  const addProduct = useCallback(
    (p: Product) => {
      if (repair) return toast.info('Finish or clear the repair bill first');
      const a = avail(p);
      if (a <= 0) return toast.bad(`${p.name} is out of stock at the Store`);
      setCart((c) => {
        const ex = c.find((l) => l.productId === p.id);
        if (!ex) return [...c, { productId: p.id, qty: 1, serial: '' }];
        if (ex.qty >= a) {
          toast.info(`Only ${a} of ${p.name} at the Store`);
          return c;
        }
        return c.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      });
    },
    [avail, repair],
  );

  // ?add=<productId> from the Scan screen
  const addedFromUrl = useRef<string | null>(null);
  useEffect(() => {
    const id = params.get('add');
    if (!id || products.length === 0 || addedFromUrl.current === id) return;
    addedFromUrl.current = id;
    const p = byProduct.get(id);
    if (p) addProduct(p);
    else toast.bad('That product was not found');
    const next = new URLSearchParams(params);
    next.delete('add');
    setParams(next, { replace: true });
  }, [params, products.length, byProduct, addProduct, setParams]);

  // ?customer=<id> from the Customers screen
  useEffect(() => {
    const id = params.get('customer');
    if (!id) return;
    setCustomerId(id);
    const next = new URLSearchParams(params);
    next.delete('customer');
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => focusSearch(), [focusSearch]);

  const onScan = () => {
    const code = q.trim();
    if (!code) return;
    const hit = findByCode(products, code) ?? (() => {
      const list = products.filter((p) => p.active && matchesQuery(p, code));
      return list.length === 1 ? list[0] : undefined;
    })();
    if (!hit) return toast.bad(`No product found for "${code}"`);
    addProduct(hit);
    setQ('');
    focusSearch();
  };

  const clearAll = () => {
    setCart([]);
    setRepair(null);
    setCustomerId(null);
    setDiscount({ type: 'amount', value: 0 });
    setCartOpen(false);
    focusSearch();
  };

  const openPay = useCallback(() => {
    if (!hasItems) return toast.info('Add something to the cart first');
    const missing = repair ? undefined : cart.find((l) => byProduct.get(l.productId)?.isSerialized && !l.serial.trim());
    if (missing) return toast.bad(`Enter the serial number for ${byProduct.get(missing.productId)?.name}`);
    setCartOpen(false);
    setPayOpen(true);
  }, [hasItems, repair, cart, byProduct]);

  const askClear = useCallback(() => {
    if (!hasItems) return;
    setConfirm({ title: 'Clear the cart?', text: 'All items will be removed from this sale.', yes: 'Clear cart', go: clearAll });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasItems]);

  const loadRepair = (wo: WorkOrder) => {
    const go = () => {
      setCart([]);
      setCustomerId(null);
      setDiscount({ type: 'amount', value: 0 });
      setRepair(wo);
      setTab('products');
      toast.ok(`${wo.jobNo} loaded as a repair bill`);
    };
    if (cart.length) setConfirm({ title: `Bill ${wo.jobNo}?`, text: 'This replaces the items in your cart.', yes: 'Load repair', go });
    else go();
  };

  const friendly = (e: unknown): Error => {
    if (e instanceof StockError) {
      const name = byProduct.get(e.productId)?.name ?? 'An item';
      return new Error(`${name}: ${e.message.toLowerCase()}. Lower the quantity or transfer more stock to the Store.`);
    }
    return e instanceof Error ? e : new Error(String(e));
  };

  const checkout = async (payments: Payment[]) => {
    setBusy(true);
    const result = await run(async () => {
      try {
        if (repair) return await completeRepairBilling(repair.id, payments, discountC, staff?.id ?? null, shift?.id ?? null);
        return await recordSale({
          lines: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: byProduct.get(l.productId)?.price ?? 0, serial: l.serial.trim() || undefined })),
          payments,
          discount: discountC,
          customerId,
          staffId: staff?.id ?? null,
          shiftId: shift?.id ?? null,
        });
      } catch (e) {
        throw friendly(e);
      }
    });
    setBusy(false);
    if (!result) return;
    setPayOpen(false);
    setSize(result.workOrderId ? 'a4' : readSize());
    setSale(result);
    setCart([]);
    setRepair(null);
    setCustomerId(null);
    setDiscount({ type: 'amount', value: 0 });
  };

  const setSize = (s: ReceiptSize) => {
    setSizeState(s);
    try {
      localStorage.setItem(SIZE_KEY, s);
    } catch {
      /* ignore */
    }
  };

  // ---- keyboard ----
  const modalOpen = payOpen || shiftOpen || cartOpen || !!confirm || !!sale;
  const keyRef = useRef({ modalOpen, openPay, askClear, q });
  keyRef.current = { modalOpen, openPay, askClear, q };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const k = keyRef.current;
      if (e.key === 'F2') {
        e.preventDefault();
        focusSearch();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (!k.modalOpen) k.openPay();
      } else if (e.key === 'Escape' && !k.modalOpen) {
        if (document.activeElement === searchRef.current && k.q) setQ('');
        else k.askClear();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [focusSearch]);

  const categories = useMemo(() => ['All', ...[...new Set(products.filter((p) => p.active).map((p) => p.category))].sort()], [products]);
  const shown = useMemo(() => products.filter((p) => p.active && (cat === 'All' || p.category === cat) && matchesQuery(p, q)).sort((a, b) => a.name.localeCompare(b.name)), [products, cat, q]);

  const cartPanel = (
    <CartPanel
      lines={cart}
      repair={repair}
      byProduct={byProduct}
      avail={avail}
      customer={customer}
      customers={customers}
      onCustomer={setCustomerId}
      discount={discount}
      onDiscount={setDiscount}
      subtotal={subtotal}
      discountC={discountC}
      deposit={repair?.deposit ?? 0}
      total={total}
      due={due}
      noShift={!shift}
      onShift={() => setShiftOpen(true)}
      onLine={(id, patch) => setCart((c) => c.map((l) => (l.productId === id ? { ...l, ...patch } : l)))}
      onRemove={(id) => setCart((c) => c.filter((l) => l.productId !== id))}
      onClear={askClear}
      onPay={openPay}
    />
  );

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-[28px]">Checkout</h1>
          <p className="mt-0.5 hidden items-center gap-3 text-sm text-muted md:flex">
            <span>
              <Kbd>F2</Kbd> search
            </span>
            <span>
              <Kbd>F4</Kbd> pay
            </span>
            <span>
              <Kbd>Esc</Kbd> clear cart
            </span>
          </p>
        </div>
        <Button icon={<Clock className="h-4 w-4" />} variant={shift ? 'secondary' : 'soft'} onClick={() => setShiftOpen(true)}>
          {shift ? 'Shift open' : 'Open shift'}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="min-w-0 space-y-4">
          <div className="relative">
            <ScanBarcode className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-brand" />
            <input
              ref={searchRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onScan())}
              placeholder="Scan barcode or type a name or SKU, then Enter"
              aria-label="Scan or search products"
              className="h-14 w-full rounded-2xl border border-line bg-raised pl-14 pr-12 text-lg text-ink placeholder:text-faint transition focus:border-brand/60 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand/15"
            />
            {q && (
              <button aria-label="Clear search" onClick={() => (setQ(''), focusSearch())} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'products', label: 'Products' },
              { value: 'repairs', label: `Ready repair jobs${readyJobs.length ? ` (${readyJobs.length})` : ''}` },
            ]}
          />

          {tab === 'products' ? (
            <>
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={cx(
                      'h-11 shrink-0 rounded-full border px-4 text-[13px] font-semibold transition md:h-9',
                      cat === c ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted hover:text-ink',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {shown.length === 0 ? (
                <Empty icon={<ShoppingCart className="h-6 w-6" />} title="No products match" sub="Try a different word, or scan the barcode." />
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                  {shown.slice(0, 150).map((p) => (
                    <ProductCard key={p.id} p={p} stock={avail(p)} reorder={levels.get(`${p.id}:STORE`)?.reorderPoint ?? 0} inCart={cart.find((l) => l.productId === p.id)?.qty ?? 0} onAdd={() => (addProduct(p), focusSearch())} />
                  ))}
                </div>
              )}
              {shown.length > 150 && <p className="text-center text-sm text-faint">Showing the first 150. Type to narrow it down.</p>}
            </>
          ) : readyJobs.length === 0 ? (
            <Empty icon={<Wrench className="h-6 w-6" />} title="No repair jobs are ready" sub="Jobs marked Ready by the workshop show up here for billing." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {readyJobs.map((wo) => {
                const c = customers.find((x) => x.id === wo.customerId);
                const b = bikes.find((x) => x.id === wo.bikeId);
                const t = jobTotals(wo.lines).total;
                return (
                  <button key={wo.id} onClick={() => loadRepair(wo)} className="rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition hover:border-brand/50">
                    <div className="flex items-center justify-between">
                      <span className="num font-semibold">{wo.jobNo}</span>
                      <Badge tone="ok" dot>
                        Ready
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm">{c?.name ?? 'Customer'}</div>
                    <div className="text-sm text-muted">{b ? `${b.brand} ${b.model}` : 'No bike on file'}</div>
                    <div className="mt-3 flex items-end justify-between">
                      <span className="text-xs text-faint">{wo.deposit ? `Total less deposit` : 'Total'}</span>
                      <Money value={Math.max(0, t - wo.deposit)} className="text-xl font-bold" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-card">{cartPanel}</div>
        </aside>
      </div>

      {/* phone floating cart bar */}
      {hasItems && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 p-3 lg:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button onClick={() => setCartOpen(true)} className="flex h-14 w-full items-center justify-between rounded-2xl bg-brand px-5 font-semibold text-brand-ink shadow-glow">
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> {count} {count === 1 ? 'item' : 'items'}
            </span>
            <Money value={due} className="text-lg font-bold" />
          </button>
        </div>
      )}
      <div className="lg:hidden">
        <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="Cart">
          <div className="-mx-5 -mb-5">{cartPanel}</div>
        </Modal>
      </div>

      <PayModal open={payOpen} due={due} busy={busy} noShift={!shift} onClose={() => setPayOpen(false)} onConfirm={checkout} />
      <ShiftPanel open={shiftOpen} onClose={() => setShiftOpen(false)} shift={shift} staff={staff} />

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        footer={
          <>
            <Button block onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button
              block
              variant="danger"
              onClick={() => {
                confirm?.go();
                setConfirm(null);
              }}
            >
              {confirm?.yes}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{confirm?.text}</p>
      </Modal>

      {sale && (
        <Modal
          open
          wide
          onClose={() => (setSale(null), focusSearch())}
          title={`Paid. ${sale.receiptNo}`}
          footer={
            <>
              <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                Print
              </Button>
              <Button
                variant="primary"
                block
                onClick={() => {
                  setSale(null);
                  focusSearch();
                }}
              >
                New sale
              </Button>
            </>
          }
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Money value={sale.total} className="font-display text-3xl font-bold" />
              {sale.change > 0 && (
                <div className="text-sm text-muted">
                  Change <Money value={sale.change} strong className="text-ok" />
                </div>
              )}
            </div>
            <Segmented
              value={size}
              onChange={setSize}
              options={[
                { value: '58', label: '58mm' },
                { value: '80', label: '80mm' },
                { value: 'a4', label: 'A4 invoice' },
              ]}
            />
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-2xl border border-line bg-raised p-3">
            <Receipt sale={sale} settings={settings} customer={customers.find((c) => c.id === sale.customerId)} staffName={staffList.find((s) => s.id === sale.staffId)?.name} size={size} />
          </div>
          <Receipt portal sale={sale} settings={settings} customer={customers.find((c) => c.id === sale.customerId)} staffName={staffList.find((s) => s.id === sale.staffId)?.name} size={size} />
        </Modal>
      )}
    </div>
  );
}

function ProductCard({ p, stock, reorder, inCart, onAdd }: { p: Product; stock: number; reorder: number; inCart: number; onAdd: () => void }) {
  const out = stock <= 0;
  const low = !out && stock <= reorder;
  return (
    <button
      onClick={onAdd}
      className={cx(
        'relative flex min-h-[116px] flex-col justify-between rounded-2xl border bg-surface p-3.5 text-left shadow-card transition active:scale-[0.98]',
        inCart ? 'border-brand/60' : 'border-line hover:border-brand/40',
        out && 'opacity-60',
      )}
    >
      {inCart > 0 && <span className="num absolute right-2.5 top-2.5 grid h-6 min-w-6 place-items-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-ink">{inCart}</span>}
      <div>
        <div className="pr-6 text-[11px] font-semibold uppercase tracking-wider text-faint">{p.brand}</div>
        <div className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{p.name}</div>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <Money value={p.price} className="text-lg font-bold" />
        <span className={cx('num text-xs font-semibold', out ? 'text-bad' : low ? 'text-warn' : 'text-muted')}>{out ? 'Out of stock' : low ? `Low: ${stock}` : `${stock} in store`}</span>
      </div>
    </button>
  );
}

interface CartProps {
  lines: CartLine[];
  repair: WorkOrder | null;
  byProduct: Map<string, Product>;
  avail: (p: Product) => number;
  customer: Customer | null;
  customers: Customer[];
  onCustomer: (id: string | null) => void;
  discount: Discount;
  onDiscount: (d: Discount) => void;
  subtotal: number;
  discountC: number;
  deposit: number;
  total: number;
  due: number;
  noShift: boolean;
  onShift: () => void;
  onLine: (id: string, patch: Partial<CartLine>) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPay: () => void;
}

function CartPanel(p: CartProps) {
  const empty = !p.repair && p.lines.length === 0;
  return (
    <div className="flex max-h-[inherit] flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 font-bold">
          <ShoppingCart className="h-5 w-5 text-faint" /> {p.repair ? `Repair bill ${p.repair.jobNo}` : 'Cart'}
        </h2>
        {!empty && (
          <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={p.onClear}>
            Clear
          </Button>
        )}
      </div>

      {p.noShift && (
        <button onClick={p.onShift} className="flex items-center gap-2 border-b border-warn/25 bg-warn/10 px-4 py-2 text-left text-[13px] text-warn">
          <AlertTriangle className="h-4 w-4 shrink-0" /> No shift is open. You can still sell, but tap here to open one.
        </button>
      )}

      <div className="min-h-[120px] flex-1 overflow-y-auto px-4 py-2">
        {empty ? (
          <div className="py-10 text-center text-sm text-muted">
            <ScanBarcode className="mx-auto mb-2 h-8 w-8 text-faint" />
            Scan or tap a product to start
          </div>
        ) : p.repair ? (
          <ul className="divide-y divide-line/70">
            {p.repair.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 py-2.5 text-sm">
                <span>
                  {l.name}
                  <span className="num text-faint"> x{l.qty}</span>
                </span>
                <Money value={l.qty * l.unitPrice} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-line/70">
            {p.lines.map((l) => {
              const pr = p.byProduct.get(l.productId);
              if (!pr) return null;
              return (
                <li key={l.productId} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm font-semibold">{pr.name}</div>
                    <IconButton label="Remove" className="-mr-2 -mt-1 h-9 w-9" onClick={() => p.onRemove(l.productId)}>
                      <Minus className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <Stepper value={l.qty} min={1} max={Math.max(1, p.avail(pr))} onChange={(n) => p.onLine(l.productId, { qty: n })} />
                    <div className="text-right">
                      <Money value={l.qty * pr.price} strong />
                      {l.qty > 1 && <div className="num text-xs text-faint">{(pr.price / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })} each</div>}
                    </div>
                  </div>
                  {pr.isSerialized && <Input className="mt-2 h-10" placeholder="Frame serial number (required)" value={l.serial} onChange={(e) => p.onLine(l.productId, { serial: e.target.value })} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-line px-4 py-3">
        {p.repair ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <UserRound className="h-4 w-4" /> {p.customer?.name ?? 'Customer'}
          </div>
        ) : (
          <CustomerPicker customer={p.customer} customers={p.customers} onPick={p.onCustomer} />
        )}

        {!empty && (
          <div className="flex items-center gap-2">
            <Segmented
              value={p.discount.type}
              onChange={(t) => p.onDiscount({ type: t, value: 0 })}
              options={[
                { value: 'amount', label: '₱' },
                { value: 'percent', label: '%' },
              ]}
            />
            <Input
              inputMode="decimal"
              className="h-10"
              placeholder={p.discount.type === 'amount' ? 'Discount in pesos' : 'Discount percent'}
              value={p.discount.value ? (p.discount.type === 'amount' ? p.discount.value / 100 : p.discount.value) : ''}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^\d.]/g, '')) || 0;
                p.onDiscount({ type: p.discount.type, value: p.discount.type === 'amount' ? Math.round(n * 100) : n });
              }}
            />
          </div>
        )}

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted">
            <span>Subtotal</span>
            <Money value={p.subtotal} />
          </div>
          {p.discountC > 0 && (
            <div className="flex justify-between text-ok">
              <span>Discount</span>
              <Money value={-p.discountC} />
            </div>
          )}
          {p.deposit > 0 && (
            <div className="flex justify-between text-muted">
              <span>Deposit paid</span>
              <Money value={-p.deposit} />
            </div>
          )}
        </div>
        <div className="flex items-end justify-between">
          <span className="text-sm font-medium text-muted">{p.deposit > 0 ? 'To pay' : 'Total'}</span>
          <Money value={p.due} className="font-display text-4xl font-bold leading-none" />
        </div>
        <Button variant="primary" size="xl" block disabled={empty} onClick={p.onPay}>
          Pay <Kbd>F4</Kbd>
        </Button>
      </div>
    </div>
  );
}

function CustomerPicker({ customer, customers, onPick }: { customer: Customer | null; customers: Customer[]; onPick: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return customers.filter((c) => c.name.toLowerCase().includes(s) || c.phone.replace(/\s/g, '').includes(s.replace(/\s/g, ''))).slice(0, 5);
  }, [q, customers]);
  if (customer)
    return (
      <div className="flex items-center justify-between rounded-xl bg-raised px-3 py-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <UserRound className="h-4 w-4 text-faint" /> {customer.name}
        </span>
        <button aria-label="Remove customer" className="text-faint hover:text-ink" onClick={() => onPick(null)}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  return (
    <div className="relative">
      <SearchBox className="[&_input]:h-10" placeholder="Customer (optional): name or phone" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} />
      {hits.length > 0 && (
        <ul className="absolute inset-x-0 bottom-full z-10 mb-1 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          {hits.map((c) => (
            <li key={c.id}>
              <button
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-raised"
                onClick={() => {
                  onPick(c.id);
                  setQ('');
                }}
              >
                <span className="font-medium">{c.name}</span>
                <span className="num text-xs text-faint">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
