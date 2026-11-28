import { useMemo, useState } from 'react';
import { Archive, Boxes, Layers, Plus, Printer, TrendingDown, TriangleAlert } from 'lucide-react';
import { Badge, Button, Card, Empty, Money, PageHeader, SearchBox, Segmented, Stat, Table, cx, toast } from '@/ui/kit';
import { db } from '@/data/db';
import { useLiveQuery, useProducts, useSettings, useStockMap } from '@/data/hooks';
import { available, lowStock } from '@/domain/stock';
import { moneyShort } from '@/domain/util';
import type { Product } from '@/domain/types';
import { ProductDrawer } from './ProductDrawer';
import { ProductForm } from './ProductForm';
import { printLabels } from './labels';

type View = 'all' | 'low' | 'dead' | 'bundles';
const DAY = 86_400_000;

export default function Inventory() {
  const products = useProducts();
  const { stock, get } = useStockMap();
  const settings = useSettings();
  const deadDays = settings?.deadStockDays ?? 90;
  const recentSellers = useLiveQuery(async () => {
    const cutoff = new Date(Date.now() - deadDays * DAY).toISOString();
    const rows = await db.movements.where('createdAt').aboveOrEqual(cutoff).filter((m) => m.reason === 'sale' || m.reason === 'repair').toArray();
    return new Set(rows.map((m) => m.productId));
  }, [deadDays]);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [view, setView] = useState<View>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ product?: Product } | null>(null);

  const active = useMemo(() => products.filter((p) => p.active), [products]);
  const lowIds = useMemo(() => new Set(lowStock(stock).map((r) => r.productId)), [stock]);
  const deadIds = useMemo(() => {
    const cutoff = Date.now() - deadDays * DAY;
    const s = new Set<string>();
    if (!recentSellers) return s;
    for (const p of active) if (!p.isBundle && !recentSellers.has(p.id) && new Date(p.createdAt).getTime() < cutoff) s.add(p.id);
    return s;
  }, [active, recentSellers, deadDays]);
  const value = stock.reduce((sum, l) => sum + l.quantity * (active.find((p) => p.id === l.productId)?.cost ?? 0), 0);
  const categories = useMemo(() => [...new Set(active.map((p) => p.category).filter(Boolean))].sort(), [active]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return active
      .filter((p) => {
        if (cat && p.category !== cat) return false;
        if (view === 'low' && !lowIds.has(p.id)) return false;
        if (view === 'dead' && !deadIds.has(p.id)) return false;
        if (view === 'bundles' && !p.isBundle) return false;
        if (!t) return true;
        return [p.name, p.sku, p.barcode, p.brand].some((x) => x.toLowerCase().includes(t));
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [active, q, cat, view, lowIds, deadIds]);

  const opened = products.find((p) => p.id === openId) ?? null;
  const margin = (p: Product) => (p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0);
  const avail = (p: Product, loc: 'STORE' | 'WAREHOUSE') => available(get(p.id, loc));

  const stockBadge = (p: Product) =>
    p.isBundle ? <Badge tone="violet">Bundle</Badge> : lowIds.has(p.id) ? <Badge tone="warn" dot>Low</Badge> : avail(p, 'STORE') + avail(p, 'WAREHOUSE') <= 0 ? <Badge tone="bad" dot>Out</Badge> : null;

  const labels = () => {
    try { printLabels(rows.map((product) => ({ product, copies: 1 }))); } catch (e) { toast.error(e); }
  };

  return (
    <div>
      <PageHeader
        title="Inventory"
        sub="Everything in the store and warehouse"
        actions={
          <>
            <Button icon={<Printer className="h-4 w-4" />} disabled={!rows.length} onClick={labels} className="hidden md:inline-flex">Print labels</Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({})}>New product</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Products" value={active.length} icon={<Boxes className="h-4 w-4" />} onClick={() => setView('all')} />
        <Stat label="Stock value at cost" value={moneyShort(value)} hint="Store + Warehouse" icon={<Layers className="h-4 w-4" />} />
        <Stat label="Low stock" value={lowIds.size} tone={lowIds.size ? 'warn' : undefined} icon={<TriangleAlert className="h-4 w-4" />} onClick={() => setView('low')} />
        <Stat label="Dead stock" value={deadIds.size} hint={`No sales in ${deadDays} days`} tone={deadIds.size ? 'bad' : undefined} icon={<TrendingDown className="h-4 w-4" />} onClick={() => setView('dead')} />
      </div>

      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchBox className="md:max-w-sm md:flex-1" placeholder="Search name, SKU, barcode or brand" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} />
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[{ value: 'all', label: 'All' }, { value: 'low', label: 'Low stock' }, { value: 'dead', label: 'Dead stock' }, { value: 'bundles', label: 'Bundles' }]}
          />
        </div>
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {['', ...categories].map((c) => (
          <button
            key={c || 'all'}
            onClick={() => setCat(c)}
            className={cx('h-9 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition', cat === c ? 'border-brand/50 bg-brand-soft text-brand' : 'border-line bg-raised text-muted hover:text-ink')}
          >
            {c || 'All categories'}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty
          icon={<Archive className="h-5 w-5" />}
          title={products.length === 0 ? 'No products yet' : 'Nothing matches'}
          sub={products.length === 0 ? 'Add your first product to start tracking stock.' : 'Try a different search or filter.'}
          action={products.length === 0 ? <Button variant="primary" onClick={() => setForm({})}>New product</Button> : <Button onClick={() => { setQ(''); setCat(''); setView('all'); }}>Clear filters</Button>}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table
              rows={rows}
              rowKey={(p) => p.id}
              onRow={(p) => setOpenId(p.id)}
              cols={[
                { key: 'p', label: 'Product', cell: (p) => (
                  <div>
                    <div className="flex items-center gap-2 font-semibold">{p.name} {stockBadge(p)}</div>
                    <div className="text-xs text-faint">{p.sku}{p.brand ? ` · ${p.brand}` : ''}</div>
                  </div>
                ) },
                { key: 'c', label: 'Category', cell: (p) => <span className="text-muted">{p.category}</span> },
                { key: 'so', label: 'Store on hand', align: 'right', cell: (p) => (p.isBundle ? '-' : get(p.id, 'STORE')?.quantity ?? 0) },
                { key: 'sr', label: 'Reserved', align: 'right', cell: (p) => (p.isBundle ? '-' : get(p.id, 'STORE')?.reserved ?? 0) },
                { key: 'sa', label: 'Store avail.', align: 'right', cell: (p) => (p.isBundle ? '-' : <b>{avail(p, 'STORE')}</b>) },
                { key: 'wa', label: 'Warehouse avail.', align: 'right', cell: (p) => (p.isBundle ? '-' : avail(p, 'WAREHOUSE')) },
                { key: 'bin', label: 'Bin', cell: (p) => <span className="text-muted">{get(p.id, 'STORE')?.bin || get(p.id, 'WAREHOUSE')?.bin || ''}</span> },
                { key: 'cost', label: 'Cost', align: 'right', cell: (p) => <Money value={p.cost} /> },
                { key: 'price', label: 'Price', align: 'right', cell: (p) => <Money value={p.price} strong /> },
                { key: 'm', label: 'Margin', align: 'right', cell: (p) => `${margin(p)}%` },
              ]}
            />
          </div>
          <div className="space-y-2.5 md:hidden">
            {rows.map((p) => (
              <Card key={p.id} pad={false} className="min-h-[44px] p-4" role="button" tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(p.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-faint">{p.sku}{p.brand ? ` · ${p.brand}` : ''}</div>
                  </div>
                  <Money value={p.price} strong />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-sm">
                  {p.isBundle ? <Badge tone="violet">Bundle</Badge> : (
                    <div className="flex gap-4 text-muted">
                      <span>Store <b className="num text-ink">{avail(p, 'STORE')}</b></span>
                      <span>Warehouse <b className="num text-ink">{avail(p, 'WAREHOUSE')}</b></span>
                    </div>
                  )}
                  {!p.isBundle && stockBadge(p)}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <ProductDrawer product={opened} onClose={() => setOpenId(null)} onEdit={(p) => setForm({ product: p })} />
      <ProductForm open={!!form} product={form?.product} onClose={() => setForm(null)} />
    </div>
  );
}
