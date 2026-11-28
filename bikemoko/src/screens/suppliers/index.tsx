import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { db } from '@/data/db';
import { byId, useLiveQuery, useProducts, useSuppliers } from '@/data/hooks';
import { openStatus } from '../purchasing/helpers';
import { money, nowISO, uid } from '@/domain/util';
import type { Supplier, SupplierProduct } from '@/domain/types';
import { Badge, Button, Drawer, Empty, Field, Input, MoneyInput, PageHeader, SearchBox, Select, Stepper, Table, Toggle, run } from '@/ui/kit';

const BLANK = (): Supplier => ({ id: uid(), name: '', contact: '', phone: '', avgLeadDays: 3, reliability: 0.9, active: true });

async function saveSupplier(s: Supplier, isNew: boolean) {
  await db.suppliers.put(s);
  await db.outbox.add({ action: isNew ? 'create_supplier' : 'update_supplier', payload: s, createdAt: nowISO(), syncedAt: null, error: null });
}

export default function Suppliers() {
  const suppliers = useSuppliers();
  const offers = useLiveQuery(() => db.supplierProducts.toArray(), [], []);
  const pos = useLiveQuery(() => db.purchaseOrders.toArray(), [], []);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [isNew, setIsNew] = useState(false);
  const rows = useMemo(() => [...suppliers].sort((a, b) => a.name.localeCompare(b.name)), [suppliers]);

  return (
    <div>
      <PageHeader
        title="Suppliers"
        sub="Who you buy from, and their price lists"
        icon={<Truck className="h-5 w-5" />}
        actions={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(BLANK());
              setIsNew(true);
            }}
          >
            Add supplier
          </Button>
        }
      />
      <Table
        rows={rows}
        rowKey={(s) => s.id}
        onRow={(s) => {
          setEditing(s);
          setIsNew(false);
        }}
        empty={<Empty icon={<Truck className="h-6 w-6" />} title="No suppliers yet" sub="Add your first supplier to start comparing prices." />}
        cols={[
          { key: 'n', label: 'Supplier', cell: (s) => <span className="font-semibold">{s.name}{!s.active && <Badge className="ml-2">Inactive</Badge>}</span> },
          { key: 'c', label: 'Contact', cell: (s) => s.contact || 'None' },
          { key: 'p', label: 'Phone', cell: (s) => <span className="num">{s.phone || 'None'}</span> },
          { key: 'l', label: 'Avg lead', align: 'right', cell: (s) => `${s.avgLeadDays} d` },
          {
            key: 'r',
            label: 'Reliability',
            cell: (s) => (
              <div className="flex items-center gap-2">
                <div className="h-2 w-20 rounded-full bg-raised">
                  <div className={`h-full rounded-full ${s.reliability >= 0.85 ? 'bg-ok' : s.reliability >= 0.6 ? 'bg-warn' : 'bg-bad'}`} style={{ width: `${Math.round(s.reliability * 100)}%` }} />
                </div>
                <span className="num text-xs">{Math.round(s.reliability * 100)}%</span>
              </div>
            ),
          },
          { key: 'pc', label: 'Products', align: 'right', cell: (s) => offers.filter((o) => o.supplierId === s.id).length },
          { key: 'o', label: 'Open POs', align: 'right', cell: (s) => pos.filter((p) => p.supplierId === s.id && openStatus(p.status)).length },
        ]}
      />
      {editing && (
        <SupplierDrawer
          key={editing.id}
          initial={editing}
          isNew={isNew}
          onSaved={(s) => {
            setEditing(s);
            setIsNew(false);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SupplierDrawer({ initial, isNew, onSaved, onClose }: { initial: Supplier; isNew: boolean; onSaved: (s: Supplier) => void; onClose: () => void }) {
  const [f, setF] = useState<Supplier>(initial);
  const [err, setErr] = useState('');
  const set = <K extends keyof Supplier>(k: K, v: Supplier[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) return setErr('Please enter a name');
    setErr('');
    const s = { ...f, name: f.name.trim() };
    const r = await run(async () => {
      await saveSupplier(s, isNew);
      return true;
    }, 'Supplier saved');
    if (r) onSaved(s);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={isNew ? 'New supplier' : f.name || 'Supplier'}
      footer={
        <Button variant="primary" block onClick={save}>
          Save supplier
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name" error={err}>
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact person">
            <Input value={f.contact} onChange={(e) => set('contact', e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Average lead days">
            <Stepper value={f.avgLeadDays} min={0} max={365} onChange={(n) => set('avgLeadDays', n)} />
          </Field>
          <Field label="Reliability %" hint="Updates itself as deliveries arrive">
            <Stepper value={Math.round(f.reliability * 100)} min={0} max={100} onChange={(n) => set('reliability', n / 100)} />
          </Field>
        </div>
        <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Active supplier" />
        <PriceList supplierId={f.id} saved={!isNew} />
      </div>
    </Drawer>
  );
}

function PriceList({ supplierId, saved }: { supplierId: string; saved: boolean }) {
  const products = useProducts();
  const pById = useMemo(() => byId(products), [products]);
  const offers = useLiveQuery(() => db.supplierProducts.where('supplierId').equals(supplierId).toArray(), [supplierId], []);
  const [draft, setDraft] = useState<SupplierProduct | null>(null);
  const [q, setQ] = useState('');

  if (!saved) return <p className="rounded-xl bg-raised px-3 py-3 text-sm text-muted">Save the supplier first, then add its price list here.</p>;

  const startNew = () => {
    setQ('');
    setDraft({ id: uid(), supplierId, productId: '', supplierSku: '', unitCost: 0, leadDays: 3, moq: 1 });
  };
  const taken = new Set(offers.map((o) => o.productId));
  const term = q.trim().toLowerCase();
  const matches = products
    .filter((p) => p.active && (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)))
    .filter((p) => p.id === draft?.productId || !taken.has(p.id))
    .slice(0, 50);
  const isEdit = !!draft && offers.some((o) => o.id === draft.id);

  const saveOffer = async () => {
    if (!draft) return;
    if (!draft.productId) return void run(async () => { throw new Error('Choose a product'); });
    if (draft.unitCost <= 0) return void run(async () => { throw new Error('Enter a unit cost'); });
    const d = draft;
    const r = await run(async () => {
      await db.supplierProducts.put(d);
      await db.outbox.add({ action: 'save_supplier_product', payload: d, createdAt: nowISO(), syncedAt: null, error: null });
      return true;
    }, 'Price saved');
    if (r) setDraft(null);
  };
  const remove = (o: SupplierProduct) => {
    if (!window.confirm('Remove this product from the price list?')) return;
    return run(async () => {
      await db.supplierProducts.delete(o.id);
      await db.outbox.add({ action: 'delete_supplier_product', payload: { id: o.id }, createdAt: nowISO(), syncedAt: null, error: null });
    }, 'Removed');
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-faint">Price list</h4>
        {!draft && <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={startNew}>Add product</Button>}
      </div>
      {draft && (
        <div className="mb-3 space-y-3 rounded-xl border border-brand/40 bg-raised p-3">
          {!isEdit && (
            <>
              <SearchBox value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder="Search products" />
              <Select aria-label="Choose product" value={draft.productId} onChange={(e) => setDraft({ ...draft, productId: e.target.value })}>
                <option value="">Choose a product</option>
                {matches.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </>
          )}
          {isEdit && <div className="font-medium">{pById.get(draft.productId)?.name}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier SKU">
              <Input value={draft.supplierSku} onChange={(e) => setDraft({ ...draft, supplierSku: e.target.value })} />
            </Field>
            <Field label="Unit cost">
              <MoneyInput value={draft.unitCost} onChange={(c) => setDraft({ ...draft, unitCost: c })} />
            </Field>
            <Field label="Lead days">
              <Stepper value={draft.leadDays} min={0} max={365} onChange={(n) => setDraft({ ...draft, leadDays: n })} />
            </Field>
            <Field label="Minimum order (MOQ)">
              <Stepper value={draft.moq} min={1} onChange={(n) => setDraft({ ...draft, moq: n })} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button block onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" block onClick={saveOffer}>Save price</Button>
          </div>
        </div>
      )}
      {offers.length ? (
        <div className="space-y-2">
          {offers.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-raised p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{pById.get(o.productId)?.name ?? 'Unknown product'}</div>
                <div className="num text-xs text-muted">
                  {o.supplierSku || 'No SKU'}, {money(o.unitCost)}, {o.leadDays} d, MOQ {o.moq}
                </div>
              </div>
              <div className="flex">
                <Button variant="ghost" size="sm" aria-label="Edit" onClick={() => setDraft(o)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => remove(o)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !draft && <Empty title="No prices yet" sub="Add the products this supplier sells." />
      )}
    </div>
  );
}
