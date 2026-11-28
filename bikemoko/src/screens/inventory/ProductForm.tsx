import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Modal, MoneyInput, Select, Stepper, Toggle, run } from '@/ui/kit';
import { useProducts } from '@/data/hooks';
import { createProduct, updateProduct, type ProductInput } from '@/data/inventoryActions';
import { useSession } from '@/app/session';
import type { Product } from '@/domain/types';

const blank: ProductInput = {
  sku: '', barcode: '', name: '', category: '', brand: '', unit: 'pc', cost: 0, price: 0,
  isSerialized: false, isBundle: false, bundleItems: [],
};

/** New product (no `product`) or edit. `initial` prefills a new product, for example from a scan. */
export function ProductForm({ open, onClose, product, initial, onSaved }: { open: boolean; onClose: () => void; product?: Product; initial?: Partial<ProductInput>; onSaved?: (p: Product) => void }) {
  // Remount on open so the form always starts from the right values.
  if (!open) return null;
  return <FormBody key={product?.id ?? 'new'} onClose={onClose} product={product} initial={initial} onSaved={onSaved} />;
}

function FormBody({ onClose, product, initial, onSaved }: { onClose: () => void; product?: Product; initial?: Partial<ProductInput>; onSaved?: (p: Product) => void }) {
  const products = useProducts();
  const { staff } = useSession();
  const [f, setF] = useState<ProductInput>(() => (product ? { ...product } : { ...blank, ...initial }));
  const [openStore, setOpenStore] = useState(0);
  const [openWh, setOpenWh] = useState(0);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const candidates = products.filter((p) => p.id !== product?.id && !p.isBundle && !f.bundleItems.some((b) => b.productId === p.id));

  const dupSku = f.sku.trim() && products.find((p) => p.id !== product?.id && p.sku.toLowerCase() === f.sku.trim().toLowerCase());
  const dupBar = f.barcode.trim() && products.find((p) => p.id !== product?.id && p.barcode && p.barcode.toLowerCase() === f.barcode.trim().toLowerCase());
  const margin = f.price > 0 ? Math.round(((f.price - f.cost) / f.price) * 100) : 0;

  const save = async () => {
    setBusy(true);
    const saved = await run(async () => {
      if (product) {
        await updateProduct(product.id, f);
        return { ...product, ...f } as Product;
      }
      return createProduct(f, { STORE: openStore, WAREHOUSE: openWh }, staff?.id);
    }, product ? 'Product saved' : 'Product added');
    setBusy(false);
    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={product ? 'Edit product' : 'New product'}
      footer={
        <>
          <Button block variant="secondary" onClick={onClose}>Cancel</Button>
          <Button block variant="primary" loading={busy} disabled={!f.name.trim() || !f.sku.trim() || !!dupSku || !!dupBar} onClick={save}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" className="md:col-span-2">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="Chain 11-speed" />
        </Field>
        <Field label="SKU" error={dupSku ? `Already used by ${dupSku.name}` : undefined}>
          <Input value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="CH-KMC-11" />
        </Field>
        <Field label="Barcode" error={dupBar ? `Already used by ${dupBar.name}` : undefined} hint="Scan it with a barcode gun, or type it">
          <Input value={f.barcode} onChange={(e) => set('barcode', e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Category">
          <Input value={f.category} onChange={(e) => set('category', e.target.value)} list="inv-categories" placeholder="Drivetrain" />
          <datalist id="inv-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Brand">
          <Input value={f.brand} onChange={(e) => set('brand', e.target.value)} />
        </Field>
        <Field label="Unit">
          <Input value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pc" />
        </Field>
        <div />
        <Field label="Cost">
          <MoneyInput value={f.cost} onChange={(v) => set('cost', v)} />
        </Field>
        <Field label="Price" hint={f.price > 0 ? `Margin ${margin}%` : undefined}>
          <MoneyInput value={f.price} onChange={(v) => set('price', v)} />
        </Field>
        <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:gap-8">
          <Toggle checked={f.isSerialized} onChange={(v) => set('isSerialized', v)} label="Has a serial number (bikes, frames)" />
          <Toggle checked={f.isBundle} onChange={(v) => set('isBundle', v)} label="Bundle or kit" />
        </div>

        {f.isBundle && (
          <div className="rounded-2xl border border-line p-4 md:col-span-2">
            <div className="mb-2 text-[13px] font-medium text-muted">Parts in this bundle</div>
            {f.bundleItems.length === 0 && <p className="mb-2 text-sm text-faint">No parts yet. Add the products that make up this kit.</p>}
            <div className="space-y-2">
              {f.bundleItems.map((b) => (
                <div key={b.productId} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">{byId.get(b.productId)?.name ?? 'Missing product'}</div>
                  <Stepper value={b.qty} min={1} onChange={(q) => set('bundleItems', f.bundleItems.map((x) => (x.productId === b.productId ? { ...x, qty: q } : x)))} />
                  <button type="button" aria-label="Remove part" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-raised hover:text-bad" onClick={() => set('bundleItems', f.bundleItems.filter((x) => x.productId !== b.productId))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add a part">
                <option value="">Add a part...</option>
                {candidates.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
              </Select>
              <Button icon={<Plus className="h-4 w-4" />} disabled={!pick} onClick={() => { set('bundleItems', [...f.bundleItems, { productId: pick, qty: 1 }]); setPick(''); }}>
                Add
              </Button>
            </div>
          </div>
        )}

        {!product && !f.isBundle && (
          <div className="grid grid-cols-2 gap-4 md:col-span-2">
            <Field label="Opening stock: Store">
              <Stepper value={openStore} onChange={setOpenStore} />
            </Field>
            <Field label="Opening stock: Warehouse">
              <Stepper value={openWh} onChange={setOpenWh} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

