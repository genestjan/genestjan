import { createPortal } from 'react-dom';
import { cx } from '@/ui/kit';
import { money } from '@/domain/util';
import { PAY_METHODS } from '@/domain/payments';
import type { Customer, Sale, Settings } from '@/domain/types';

export type ReceiptSize = '58' | '80' | 'a4';

const NOT_OFFICIAL = 'This is not an official receipt / BIR invoice.';

const WIDTH: Record<ReceiptSize, string> = { '58': '58mm', '80': '80mm', a4: '210mm' };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

interface Props {
  sale: Sale;
  settings?: Settings;
  customer?: Customer | null;
  staffName?: string;
  size: ReceiptSize;
  /** Render into document.body as the print copy (hidden on screen). */
  portal?: boolean;
}

/** Thermal receipt (58mm or 80mm) or A4 service invoice. Prints only this element. */
export function Receipt({ sale, settings, customer, staffName, size, portal }: Props) {
  const a4 = size === 'a4';
  const small = size === '58';
  const method = (m: string) => PAY_METHODS.find((p) => p.id === m)?.label ?? m;
  const paid = sale.payments.reduce((s, p) => s + p.amount, 0);
  const sheet = (
    <div
      className={cx('receipt-sheet mx-auto bg-white font-mono text-black', a4 ? 'p-8 text-[13px]' : small ? 'p-2 text-[10px] leading-snug' : 'p-3 text-[12px] leading-snug')}
      style={{ width: WIDTH[size], maxWidth: '100%' }}
    >
      <div className={cx('text-center', a4 && 'text-left')}>
        <div className={cx('font-bold', a4 ? 'text-2xl' : 'text-sm')}>{settings?.shopName ?? 'Bikemoko'}</div>
        {settings?.address && <div>{settings.address}</div>}
        {settings?.phone && <div>{settings.phone}</div>}
        {a4 && <div className="mt-4 text-lg font-bold uppercase tracking-wide">{sale.workOrderId ? 'Service invoice' : 'Invoice'}</div>}
      </div>
      <div className={cx('my-2 border-t border-dashed border-black pt-2', a4 && 'grid grid-cols-2 gap-x-6')}>
        <div>Receipt no: {sale.receiptNo}</div>
        <div>Date: {fmtDate(sale.createdAt)}</div>
        {customer && <div>Customer: {customer.name}</div>}
        {staffName && <div>Served by: {staffName}</div>}
      </div>
      <table className="w-full border-t border-dashed border-black">
        <tbody>
          {sale.lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-0.5 pr-2">
                {l.name}
                {l.serial && <div className="opacity-80">S/N {l.serial}</div>}
                <div className="opacity-80">
                  {l.qty} x {money(l.unitPrice)}
                </div>
              </td>
              <td className="py-0.5 text-right">{money(l.qty * l.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 space-y-0.5 border-t border-dashed border-black pt-1">
        <Row k="Subtotal" v={money(sale.subtotal)} />
        {sale.discount > 0 && <Row k="Discount" v={`-${money(sale.discount)}`} />}
        <Row k="TOTAL" v={money(sale.total)} bold />
        {sale.payments.map((p, i) => (
          <Row key={i} k={`${method(p.method)}${p.ref ? ` (${p.ref})` : ''}`} v={money(p.amount)} />
        ))}
        {paid > sale.total && sale.change > 0 && <Row k="Change" v={money(sale.change)} bold />}
      </div>
      <div className="mt-3 border-t border-dashed border-black pt-2 text-center">
        {settings && settings.warrantyDays > 0 && <div>Warranty: {settings.warrantyDays} days on parts and labour</div>}
        {settings?.receiptFooter && <div className="mt-1">{settings.receiptFooter}</div>}
        <div className={cx('mt-1 opacity-80', a4 ? 'text-[11px]' : 'text-[9px]')}>{NOT_OFFICIAL}</div>
      </div>
    </div>
  );

  const pageCss = `@page { size: ${a4 ? 'A4' : `${WIDTH[size]} auto`}; margin: ${a4 ? '12mm' : '2mm'}; }
.receipt-print-root { display: none; }
@media print {
  body > *:not(.receipt-print-root) { display: none !important; }
  .receipt-print-root { display: block !important; }
  html, body { background: white !important; }
}`;

  if (!portal) return sheet;
  return createPortal(
    <div className="receipt-print-root">
      <style>{pageCss}</style>
      {sheet}
    </div>,
    document.body,
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={cx('flex justify-between gap-2', bold && 'font-bold')}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
