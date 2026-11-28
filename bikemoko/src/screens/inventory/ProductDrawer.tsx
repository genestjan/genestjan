import { useEffect, useState } from 'react';
import { ArrowLeftRight, ClipboardCheck, Pencil, Printer } from 'lucide-react';
import { Badge, Button, Drawer, Field, Input, Modal, Money, Section, Select, Stepper, run, toast, type Tone } from '@/ui/kit';
import { adjustCount, transferStock, updateLevelSettings } from '@/data/actions';
import { db } from '@/data/db';
import { byId, useLiveQuery, useStaff, useStockMap } from '@/data/hooks';
import { useSession } from '@/app/session';
import { available } from '@/domain/stock';
import type { LocationCode, MovementReason, Product, StockMovement } from '@/domain/types';
import { printLabels } from './labels';

const LOC: Record<LocationCode, string> = { STORE: 'Store', WAREHOUSE: 'Warehouse' };
const REASON: Record<MovementReason, { label: string; tone: Tone }> = {
  sale: { label: 'Sale', tone: 'ok' },
  po_receive: { label: 'Received', tone: 'info' },
  transfer: { label: 'Transfer', tone: 'brand' },
  repair: { label: 'Repair', tone: 'violet' },
  adjustment: { label: 'Count', tone: 'warn' },
  return: { label: 'Return', tone: 'neutral' },
  opening: { label: 'Opening', tone: 'neutral' },
};

export function ProductDrawer({ product, onClose, onEdit }: { product: Product | null; onClose: () => void; onEdit: (p: Product) => void }) {
  const [modal, setModal] = useState<'transfer' | 'count' | null>(null);
  if (!product) return null;
  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={product.name}
        sub={`${product.sku}${product.brand ? ` · ${product.brand}` : ''}`}
        footer={
          <>
            <Button block icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(product)}>Edit</Button>
            <Button block icon={<Printer className="h-4 w-4" />} onClick={() => { try { printLabels([{ product, copies: 1 }]); } catch (e) { toast.error(e); } }}>Label</Button>
          </>
        }
      >
        <Body product={product} onAction={setModal} />
      </Drawer>
      {modal === 'transfer' && <TransferModal product={product} onClose={() => setModal(null)} />}
      {modal === 'count' && <CountModal product={product} onClose={() => setModal(null)} />}
    </>
  );
}

function Body({ product, onAction }: { product: Product; onAction: (m: 'transfer' | 'count') => void }) {
  const { get } = useStockMap();
  const staff = useStaff();
  const staffById = byId(staff);
  const history = useLiveQuery(async () => {
    const rows = await db.movements.where('productId').equals(product.id).toArray();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  }, [product.id]) as StockMovement[] | undefined;
  const margin = product.price > 0 ? Math.round(((product.price - product.cost) / product.price) * 100) : 0;
  const parts = useLiveQuery(() => db.products.bulkGet(product.bundleItems.map((b) => b.productId)), [product.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {product.category && <Badge>{product.category}</Badge>}
        {product.isSerialized && <Badge tone="info">Serial number</Badge>}
        {product.isBundle && <Badge tone="violet">Bundle</Badge>}
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Info label="Cost"><Money value={product.cost} /></Info>
        <Info label="Price"><Money value={product.price} strong /></Info>
        <Info label="Margin"><span className="num">{margin}%</span></Info>
        <Info label="Barcode"><span className="num break-all">{product.barcode || 'None'}</span></Info>
        <Info label="Unit">{product.unit}</Info>
      </div>

      {product.isBundle ? (
        <Section title="Parts in this bundle">
          <ul className="space-y-1.5 text-sm">
            {product.bundleItems.map((b, i) => (
              <li key={b.productId} className="flex justify-between rounded-xl bg-raised px-3 py-2">
                <span>{parts?.[i]?.name ?? 'Missing product'}</span>
                <span className="num font-semibold">x{b.qty}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : (
        <>
          <Section title="Stock">
            <div className="space-y-3">
              {(['STORE', 'WAREHOUSE'] as LocationCode[]).map((loc) => (
                <LevelCard key={loc} product={product} loc={loc} level={get(product.id, loc)} />
              ))}
            </div>
          </Section>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" icon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => onAction('transfer')}>Transfer</Button>
            <Button size="lg" icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => onAction('count')}>Count</Button>
          </div>
        </>
      )}

      <Section title="Movement history">
        {!history?.length ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No movements yet.</p>
        ) : (
          <ul className="divide-y divide-line/70 rounded-2xl border border-line">
            {history.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={REASON[m.reason].tone}>{REASON[m.reason].label}</Badge>
                    <span className="text-muted">{m.from ? LOC[m.from] : 'Outside'} to {m.to ? LOC[m.to] : 'Outside'}</span>
                  </div>
                  <div className="mt-1 text-xs text-faint">
                    {new Date(m.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                    {m.staffId && staffById.get(m.staffId) ? ` · ${staffById.get(m.staffId)!.name}` : ''}
                  </div>
                </div>
                <span className="num text-base font-bold">{m.qty}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-raised px-3 py-2">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-0.5 font-semibold">{children}</div>
    </div>
  );
}

function LevelCard({ product, loc, level }: { product: Product; loc: LocationCode; level: ReturnType<ReturnType<typeof useStockMap>['get']> }) {
  const [rp, setRp] = useState(level?.reorderPoint ?? 0);
  const [bin, setBin] = useState(level?.bin ?? '');
  // Follow changes made elsewhere (for example a sync) when the saved values change.
  useEffect(() => { setRp(level?.reorderPoint ?? 0); setBin(level?.bin ?? ''); }, [level?.reorderPoint, level?.bin]);
  const dirty = rp !== (level?.reorderPoint ?? 0) || bin !== (level?.bin ?? '');
  const low = rp > 0 && available(level) <= rp;
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold">{LOC[loc]}</div>
          <div className="text-xs text-faint">{level?.quantity ?? 0} on hand · {level?.reserved ?? 0} reserved</div>
        </div>
        <div className="text-right">
          <div className="num font-display text-2xl font-bold">{available(level)}</div>
          <div className="text-xs text-faint">available</div>
        </div>
      </div>
      {low && <div className="mt-2"><Badge tone="warn" dot>Low stock</Badge></div>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Reorder point"><Stepper value={rp} onChange={setRp} /></Field>
        <Field label="Bin"><Input value={bin} onChange={(e) => setBin(e.target.value)} placeholder="A-12" /></Field>
      </div>
      {dirty && (
        <Button className="mt-3" size="sm" variant="primary" onClick={() => run(() => updateLevelSettings(product.id, loc, { reorderPoint: rp, bin: bin.trim() }), 'Saved')}>
          Save
        </Button>
      )}
    </div>
  );
}

function TransferModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { get } = useStockMap();
  const { staff } = useSession();
  const [from, setFrom] = useState<LocationCode>('WAREHOUSE');
  const [qty, setQty] = useState(1);
  const to: LocationCode = from === 'STORE' ? 'WAREHOUSE' : 'STORE';
  const max = Math.max(0, available(get(product.id, from)));
  return (
    <Modal
      open
      onClose={onClose}
      title="Transfer stock"
      footer={
        <>
          <Button block onClick={onClose}>Cancel</Button>
          <Button block variant="primary" disabled={qty < 1 || qty > max} onClick={async () => { if (await run(async () => { await transferStock(product.id, from, to, qty, staff?.id); return true; }, `Moved ${qty} to ${LOC[to]}`)) onClose(); }}>
            Move {qty}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <Select value={from} onChange={(e) => { setFrom(e.target.value as LocationCode); setQty(1); }}>
              <option value="WAREHOUSE">Warehouse</option>
              <option value="STORE">Store</option>
            </Select>
          </Field>
          <Field label="To"><Input value={LOC[to]} readOnly /></Field>
        </div>
        <Field label="How many" hint={`${max} available in ${LOC[from].toLowerCase()}`}>
          <Stepper value={qty} min={1} max={Math.max(1, max)} onChange={setQty} />
        </Field>
      </div>
    </Modal>
  );
}

function CountModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { get } = useStockMap();
  const { staff } = useSession();
  const [loc, setLoc] = useState<LocationCode>('STORE');
  const [counted, setCounted] = useState<number | null>(null);
  const current = get(product.id, loc)?.quantity ?? 0;
  const value = counted ?? current;
  return (
    <Modal
      open
      onClose={onClose}
      title="Count stock"
      footer={
        <>
          <Button block onClick={onClose}>Cancel</Button>
          <Button block variant="primary" onClick={async () => { if (await run(async () => { await adjustCount(product.id, loc, value, staff?.id); return true; }, 'Count saved')) onClose(); }}>
            Save count
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Where did you count?">
          <Select value={loc} onChange={(e) => { setLoc(e.target.value as LocationCode); setCounted(null); }}>
            <option value="STORE">Store</option>
            <option value="WAREHOUSE">Warehouse</option>
          </Select>
        </Field>
        <Field label="Counted on the shelf" hint={`The system says ${current}. Any difference is saved as a count adjustment.`}>
          <Stepper value={value} onChange={setCounted} />
        </Field>
      </div>
    </Modal>
  );
}
