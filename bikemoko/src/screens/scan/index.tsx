import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Keyboard, PackagePlus, ScanLine, ShoppingCart, SlidersHorizontal, Truck, X } from 'lucide-react';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Section, Stepper, Select, run, toast } from '@/ui/kit';
import { adjustCount, receivePO, transferStock } from '@/data/actions';
import { db } from '@/data/db';
import { findProductByCode } from '@/data/inventoryActions';
import { useLiveQuery, useStockMap } from '@/data/hooks';
import { useSession } from '@/app/session';
import { available } from '@/domain/stock';
import type { LocationCode, Product, PurchaseOrder } from '@/domain/types';
import { ProductForm } from '../inventory/ProductForm';
import { scanMode, scanNative, startWebScan } from './scanner';

interface Recent { code: string; name: string | null; at: number }
type Step = 'menu' | 'move' | 'receive' | 'adjust';

export default function Scan() {
  const mode = scanMode();
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState('');
  const [found, setFound] = useState<{ code: string; product: Product | null } | null>(null);
  const [create, setCreate] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);

  const handle = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const product = (await findProductByCode(code)) ?? null;
    setRecent((r) => [{ code, name: product?.name ?? null, at: Date.now() }, ...r.filter((x) => x.code !== code)].slice(0, 15));
    setFound({ code, product });
  };

  const start = async () => {
    if (mode === 'native') {
      try {
        const code = await scanNative();
        if (code) await handle(code);
      } catch (e) {
        toast.error(e);
      }
    } else setCamera(true);
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Scan" sub="Scan a barcode to sell, move or count" />
      {mode !== 'manual' && (
        <Button block size="xl" variant="primary" icon={<Camera className="h-6 w-6" />} onClick={start}>Scan barcode</Button>
      )}
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void handle(manual); setManual(''); }}>
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder={mode === 'manual' ? 'Type or scan a barcode or SKU' : 'Or type a barcode or SKU'} aria-label="Barcode or SKU" autoFocus={mode === 'manual'} className="h-12" />
        <Button size="lg" type="submit" icon={<Keyboard className="h-4 w-4" />} disabled={!manual.trim()}>Find</Button>
      </form>
      {mode === 'manual' && <p className="mt-2 text-xs text-faint">This device cannot use the camera for scanning. A barcode gun works here too.</p>}

      <Section title="Recent scans" className="mt-8">
        {recent.length === 0 ? (
          <Empty icon={<ScanLine className="h-5 w-5" />} title="No scans yet" sub="Items you scan show up here." />
        ) : (
          <div className="space-y-2">
            {recent.map((r) => (
              <button key={r.code} onClick={() => void handle(r.code)} className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 text-left hover:border-brand/40">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{r.name ?? 'Unknown code'}</div>
                  <div className="num text-xs text-faint">{r.code}</div>
                </div>
                {r.name ? <ArrowRight className="h-4 w-4 text-faint" /> : <Badge tone="warn">New</Badge>}
              </button>
            ))}
          </div>
        )}
      </Section>

      {camera && <WebCamera onClose={() => setCamera(false)} onCode={(c) => { setCamera(false); void handle(c); }} />}
      {found && <ResultSheet found={found} onClose={() => setFound(null)} onCreate={(code) => { setFound(null); setCreate(code); }} />}
      <ProductForm open={create !== null} initial={{ barcode: create ?? '' }} onClose={() => setCreate(null)} onSaved={(p) => { setRecent((r) => [{ code: p.barcode || p.sku, name: p.name, at: Date.now() }, ...r].slice(0, 15)); setFound({ code: p.barcode || p.sku, product: p }); }} />
    </div>
  );
}

function WebCamera({ onClose, onCode }: { onClose: () => void; onCode: (c: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    let stop: (() => void) | undefined;
    let dead = false;
    startWebScan(video.current!, (c) => cb.current(c))
      .then((s) => { if (dead) s(); else stop = s; })
      .catch((e: Error) => setError(e.message));
    return () => { dead = true; stop?.(); };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={video} playsInline muted className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-40 w-[80%] max-w-sm rounded-2xl border-2 border-brand" />
      </div>
      <div className="safe-t absolute inset-x-0 top-0 flex items-center justify-between p-4 text-white">
        <span className="font-semibold">Point at a barcode</span>
        <button onClick={onClose} aria-label="Close camera" className="grid h-12 w-12 place-items-center rounded-full bg-black/50"><X className="h-6 w-6" /></button>
      </div>
      {error && (
        <div className="absolute inset-x-4 bottom-8 rounded-2xl bg-surface p-4 text-sm text-ink">
          <p className="mb-3">{error}</p>
          <Button block onClick={onClose}>Type the code instead</Button>
        </div>
      )}
    </div>
  );
}

function ResultSheet({ found, onClose, onCreate }: { found: { code: string; product: Product | null }; onClose: () => void; onCreate: (code: string) => void }) {
  const { product } = found;
  const nav = useNavigate();
  const { get } = useStockMap();
  const [step, setStep] = useState<Step>('menu');

  if (!product) {
    return (
      <Modal open onClose={onClose} title="Not found" footer={<><Button block onClick={onClose}>Close</Button><Button block variant="primary" icon={<PackagePlus className="h-4 w-4" />} onClick={() => onCreate(found.code)}>Create product with this barcode</Button></>}>
        <p className="text-sm text-muted">Nothing in the catalogue matches <b className="num text-ink">{found.code}</b>.</p>
      </Modal>
    );
  }
  const store = available(get(product.id, 'STORE'));
  const wh = available(get(product.id, 'WAREHOUSE'));
  return (
    <Modal open onClose={onClose} title={step === 'menu' ? product.name : STEP_TITLE[step]}>
      {step === 'menu' ? (
        <div>
          <div className="mb-4 text-xs text-faint">{product.sku}{product.brand ? ` · ${product.brand}` : ''}</div>
          {product.isBundle ? (
            <p className="mb-4 text-sm text-muted">This is a bundle. Stock is counted on its parts.</p>
          ) : (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Card className="text-center"><div className="text-xs text-faint">Store</div><div className="num font-display text-3xl font-bold">{store}</div></Card>
              <Card className="text-center"><div className="text-xs text-faint">Warehouse</div><div className="num font-display text-3xl font-bold">{wh}</div></Card>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button size="xl" variant="primary" icon={<ShoppingCart className="h-5 w-5" />} onClick={() => nav(`/pos?add=${product.id}`)}>Sell</Button>
            {!product.isBundle && (
              <>
                <Button size="xl" icon={<Truck className="h-5 w-5" />} onClick={() => setStep('move')}>Move to Store</Button>
                <Button size="xl" icon={<PackagePlus className="h-5 w-5" />} onClick={() => setStep('receive')}>Receive PO</Button>
                <Button size="xl" icon={<SlidersHorizontal className="h-5 w-5" />} onClick={() => setStep('adjust')}>Adjust</Button>
              </>
            )}
          </div>
        </div>
      ) : step === 'move' ? (
        <MoveStep product={product} max={wh} onBack={() => setStep('menu')} onDone={onClose} />
      ) : step === 'receive' ? (
        <ReceiveStep product={product} onBack={() => setStep('menu')} onDone={onClose} />
      ) : (
        <AdjustStep product={product} onBack={() => setStep('menu')} onDone={onClose} />
      )}
    </Modal>
  );
}

const STEP_TITLE: Record<Step, string> = { menu: '', move: 'Warehouse to Store', receive: 'Receive PO', adjust: 'Adjust count' };

function MoveStep({ product, max, onBack, onDone }: { product: Product; max: number; onBack: () => void; onDone: () => void }) {
  const { staff } = useSession();
  const [qty, setQty] = useState(1);
  return (
    <div className="space-y-4">
      <Field label="How many to move" hint={`${max} available in the warehouse`}><Stepper value={qty} min={1} max={Math.max(1, max)} onChange={setQty} /></Field>
      <Footer onBack={onBack} label={`Move ${qty}`} disabled={qty < 1 || qty > max} onGo={async () => { if (await run(async () => { await transferStock(product.id, 'WAREHOUSE', 'STORE', qty, staff?.id); return true; }, `Moved ${qty} to Store`)) onDone(); }} />
    </div>
  );
}

function ReceiveStep({ product, onBack, onDone }: { product: Product; onBack: () => void; onDone: () => void }) {
  const { staff } = useSession();
  const pos = useLiveQuery(async () => (await db.purchaseOrders.where('status').anyOf('sent', 'partial').toArray()).filter((po) => po.items.some((i) => i.productId === product.id && i.receivedQty < i.qty)), [product.id]);
  const [poId, setPoId] = useState('');
  const [qty, setQty] = useState(1);
  const po: PurchaseOrder | undefined = pos?.find((p) => p.id === (poId || pos[0]?.id));
  const item = po?.items.find((i) => i.productId === product.id);
  const left = item ? item.qty - item.receivedQty : 0;
  useEffect(() => { setQty(Math.max(1, left)); }, [po?.id, left]);
  if (!pos) return null;
  if (!po || !item) return <div className="space-y-4"><Empty title="No open orders" sub="No sent purchase order is waiting for this product." /><Button block onClick={onBack}>Back</Button></div>;
  return (
    <div className="space-y-4">
      {pos.length > 1 && (
        <Field label="Purchase order">
          <Select value={po.id} onChange={(e) => setPoId(e.target.value)}>{pos.map((p) => <option key={p.id} value={p.id}>{p.poNo}</option>)}</Select>
        </Field>
      )}
      <p className="text-sm text-muted"><b className="text-ink">{po.poNo}</b>: {item.receivedQty} of {item.qty} received, {left} still due.</p>
      <Field label="Quantity received"><Stepper value={qty} min={1} max={left} onChange={setQty} /></Field>
      <Footer onBack={onBack} label={`Receive ${qty}`} disabled={qty < 1 || qty > left} onGo={async () => { if (await run(async () => { await receivePO(po.id, [{ productId: product.id, qty }], staff?.id); return true; }, `Received ${qty} into Warehouse`)) onDone(); }} />
    </div>
  );
}

function AdjustStep({ product, onBack, onDone }: { product: Product; onBack: () => void; onDone: () => void }) {
  const { get } = useStockMap();
  const { staff } = useSession();
  const [loc, setLoc] = useState<LocationCode>('STORE');
  const [counted, setCounted] = useState<number | null>(null);
  const current = get(product.id, loc)?.quantity ?? 0;
  const value = counted ?? current;
  return (
    <div className="space-y-4">
      <Field label="Location"><Select value={loc} onChange={(e) => { setLoc(e.target.value as LocationCode); setCounted(null); }}><option value="STORE">Store</option><option value="WAREHOUSE">Warehouse</option></Select></Field>
      <Field label="Counted quantity" hint={`The system says ${current}.`}><Stepper value={value} onChange={setCounted} /></Field>
      <Footer onBack={onBack} label="Save count" onGo={async () => { if (await run(async () => { await adjustCount(product.id, loc, value, staff?.id); return true; }, 'Count saved')) onDone(); }} />
    </div>
  );
}

function Footer({ onBack, onGo, label, disabled }: { onBack: () => void; onGo: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <Button block size="lg" onClick={onBack}>Back</Button>
      <Button block size="lg" variant="primary" disabled={disabled} onClick={onGo}>{label}</Button>
    </div>
  );
}
