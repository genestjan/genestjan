import { money } from '@/domain/util';
import type { Product } from '@/domain/types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Print a grid of simple shelf labels: big barcode number, name and price. (No Code128 drawing yet.) */
export function printLabels(items: { product: Product; copies: number }[]) {
  const cells = items
    .flatMap(({ product, copies }) => Array.from({ length: copies }, () => product))
    .map(
      (p) => `<div class="l"><div class="n">${esc(p.name)}</div><div class="b">${esc(p.barcode || p.sku)}</div><div class="p">${esc(money(p.price))}</div></div>`,
    )
    .join('');
  const w = window.open('', '_blank');
  if (!w) throw new Error('Allow pop-ups to print labels');
  w.document.write(`<!doctype html><title>Labels</title><style>
    body{font-family:sans-serif;margin:8mm}
    .g{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}
    .l{border:1px solid black;padding:3mm;text-align:center;break-inside:avoid}
    .n{font-size:11pt;font-weight:600}
    .b{font-size:18pt;font-weight:700;letter-spacing:2px;margin:3mm 0;font-variant-numeric:tabular-nums}
    .p{font-size:14pt;font-weight:700}
  </style><div class="g">${cells}</div><script>window.onload=function(){window.print()}</script>`);
  w.document.close();
}
