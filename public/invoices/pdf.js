/* The invoice PDF for the Invoices app, drawn with jsPDF. Loaded the first time a PDF is asked for.
   A4, millimetres. It draws what view() in app.js describes, so the PDF and the on-screen preview
   always say the same thing. */
(() => {
'use strict';

const W = 210, L = 16, R = 194, BOTTOM = 272;
const C = {
  band: [35, 35, 35], ink: [29, 29, 28], soft: [59, 58, 55], muted: [103, 101, 95], line: [227, 225, 219],
  goldInk: [138, 98, 25], goldSoft: [248, 242, 226], white: [255, 255, 255],
  bandMuted: [190, 188, 182], bandGold: [226, 192, 113],
  ok: [46, 122, 78], okSoft: [226, 240, 231], bad: [179, 38, 30], badSoft: [251, 230, 228],
};
const GOLD = [[200, 145, 63], [227, 197, 116], [246, 234, 162]];

let assets = null;
async function loadAssets() {
  if (assets) return assets;
  const toB64 = buf => {
    const b = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const get = async p => { const r = await fetch(p); if (!r.ok) throw new Error('Missing ' + p); return toB64(await r.arrayBuffer()); };
  const names = ['Lexend-Regular', 'Lexend-SemiBold', 'PlexMono-Regular', 'PlexMono-SemiBold'];
  const fonts = {};
  await Promise.all(names.map(async n => { fonts[n] = await get('fonts/' + n + '.ttf'); }));
  const mark = 'data:image/png;base64,' + await get('img/mark.png');
  assets = { fonts, mark };
  return assets;
}

function newDoc(a, v) {
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (const [n, b64] of Object.entries(a.fonts)) doc.addFileToVFS(n + '.ttf', b64);
  doc.addFont('Lexend-Regular.ttf', 'Lexend', 'normal');
  doc.addFont('Lexend-SemiBold.ttf', 'Lexend', 'bold');
  doc.addFont('PlexMono-Regular.ttf', 'Mono', 'normal');
  doc.addFont('PlexMono-SemiBold.ttf', 'Mono', 'bold');
  doc.setProperties({ title: 'Invoice ' + clean(v.number), subject: 'Invoice ' + clean(v.number) + ' for ' + clean(v.billTo.name || v.billTo.company), author: clean(v.business.name), creator: 'Invoices' });
  return doc;
}

/* ---------- drawing helpers ---------- */

// only characters the embedded fonts have; anything else falls back to its plain letter
const HAS = /[\x20-\x7E\xA0-\xFF–‘-‚“”•…€₱−]/;
function clean(s) {
  return Array.from(String(s ?? '').replace(/\r/g, '').replace(/\t/g, ' ').replace(/[—―]/g, '-'))
    .map(ch => (ch === '\n' || HAS.test(ch) ? ch : (ch.normalize('NFKD').replace(/[^\x20-\x7E]/g, '') || '?'))).join('');
}
function font(doc, fam, style, size, color) { doc.setFont(fam, style); doc.setFontSize(size); doc.setTextColor(...color); }
// letter-spaced caps; jsPDF's charSpace is in mm
function spaced(doc, text, x, y, cs, align) {
  const w = doc.getTextWidth(text) + cs * (text.length - 1);
  doc.text(text, align === 'right' ? x - w : x, y, { charSpace: cs });
  return w;
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// the logo's brushed gold, as a strip of thin slices
function goldBar(doc, x, y, w, h) {
  const n = 64;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    doc.setFillColor(...(t < 0.55 ? mix(GOLD[0], GOLD[1], t / 0.55) : mix(GOLD[1], GOLD[2], (t - 0.55) / 0.45)));
    const sx = x + (i * w) / n;
    doc.rect(sx, y, Math.min(w / n + 0.15, x + w - sx), h, 'F');
  }
}
function hair(doc, y, x1 = L, x2 = R) { doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.line(x1, y, x2, y); }
function label(doc, text, x, y, color = C.muted) { font(doc, 'Mono', 'bold', 7, color); spaced(doc, text, x, y, 0.3); }
// lines of text wrapped to a width, keeping the line breaks the person typed
function wrap(doc, text, width) {
  const out = [];
  for (const para of clean(text).split('\n')) out.push(...(para.trim() ? doc.splitTextToSize(para, width) : ['']));
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}
// the biggest size (down to min) at which text fits the width
function fit(doc, text, width, size, min) {
  let s = size;
  doc.setFontSize(s);
  while (s > min && doc.getTextWidth(text) > width) { s -= 0.5; doc.setFontSize(s); }
  return s;
}
// one line cut to fit a width, ending in an ellipsis when it had to be cut
function clip(doc, text, width) {
  let t = clean(text);
  if (doc.getTextWidth(t) <= width) return t;
  while (t.length > 1 && doc.getTextWidth(t + '…') > width) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
const mailto = e => 'mailto:' + e;
const webUrl = w => (/^https?:\/\//i.test(w) ? w : 'https://' + w);
const looksLikeEmail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const looksLikeSite = w => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(w);

/* ---------- header and footer ---------- */

function header(doc, a, v) {
  doc.setFillColor(...C.band);
  doc.rect(0, 0, W, 46, 'F');
  goldBar(doc, 0, 46, W, 1.6);
  doc.addImage(a.mark, 'PNG', L - 2, 8, 30, 30);
  const nameW = 140 - (L + 32);
  const name = clean(v.business.name);
  doc.setFont('Lexend', 'bold');
  const size = fit(doc, name, nameW, 17, 12);
  font(doc, 'Lexend', 'bold', size, C.white);
  let lines = doc.getTextWidth(name) > nameW ? doc.splitTextToSize(name, nameW).slice(0, 2) : [name];
  if (lines.length === 2) lines[1] = clip(doc, lines[1], nameW);
  doc.text(lines, L + 32, lines.length > 1 ? 18 : 21.5, { lineHeightFactor: 1.15 });
  font(doc, 'Lexend', 'normal', 9, C.bandMuted);
  doc.text(clip(doc, v.business.tagline, nameW), L + 32, lines.length > 1 ? 32 : 28);
  font(doc, 'Lexend', 'bold', 22, C.bandGold);
  spaced(doc, 'INVOICE', R, 22, 1.4, 'right');
  font(doc, 'Mono', 'normal', 9.5, C.bandMuted);
  doc.text('No. ' + clean(v.number), R, 29.5, { align: 'right' });
  if (v.st === 'paid' || v.st === 'void') {
    const t = v.st === 'paid' ? 'PAID' : 'VOID';
    font(doc, 'Mono', 'bold', 7.5, C.white);
    const w = doc.getTextWidth(t) + 0.4 * (t.length - 1) + 6;
    doc.setFillColor(...(v.st === 'paid' ? C.ok : C.bad));
    doc.roundedRect(R - w, 33, w, 5.6, 1, 1, 'F');
    doc.text(t, R - w + 3, 37, { charSpace: 0.4 });
  }
}
// later pages: a slim band, so the items carry on without wasting space
function slimHeader(doc, a, v) {
  doc.setFillColor(...C.band);
  doc.rect(0, 0, W, 20, 'F');
  goldBar(doc, 0, 20, W, 1.1);
  doc.addImage(a.mark, 'PNG', L - 1, 3.5, 13, 13);
  font(doc, 'Lexend', 'bold', 10.5, C.white);
  doc.text(clip(doc, v.business.name, 110), L + 15, 11.8);
  font(doc, 'Lexend', 'bold', 9, C.bandGold);
  spaced(doc, 'INVOICE ' + clean(v.number), R, 11.8, 0.5, 'right');
}
function footers(doc, v) {
  const n = doc.internal.getNumberOfPages();
  const b = v.business;
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    hair(doc, 283);
    font(doc, 'Lexend', 'normal', 7.6, C.muted);
    const right = n > 1 ? `Invoice ${clean(v.number)}  ·  Page ${i} of ${n}` : `Invoice ${clean(v.number)}`;
    doc.text(right, R, 288.5, { align: 'right' });
    const stop = R - doc.getTextWidth(right) - 6;
    let x = L;
    const parts = [[b.name, '']];
    if (b.website) parts.push([b.website, looksLikeSite(b.website) ? webUrl(b.website) : '']);
    if (b.email) parts.push([b.email, looksLikeEmail(b.email) ? mailto(b.email) : '']);
    for (const [k, [t, url]] of parts.entries()) {
      const lead = k ? '  ·  ' : '';
      const room = stop - x;
      if (room < 12) break;
      const full = lead + clean(t);
      const s = doc.getTextWidth(full) <= room ? full : clip(doc, full, room);
      doc.text(s, x, 288.5);
      const w = doc.getTextWidth(s);
      if (url && s === full) { const lw = doc.getTextWidth(lead); doc.link(x + lw, 285.5, w - lw, 4, { url }); }
      x += w;
      if (s !== full) break;
    }
  }
}

/* ---------- the invoice ---------- */

const COL = { n: L + 3, desc: L + 11, qty: 133, rate: 160, amt: R - 3 };
const DESC_W = COL.qty - 20 - COL.desc;

function tableHead(doc, y, v) {
  doc.setFillColor(...C.band);
  doc.rect(L, y, R - L, 8.5, 'F');
  font(doc, 'Mono', 'bold', 6.8, C.white);
  spaced(doc, '#', COL.n, y + 5.6, 0.28);
  spaced(doc, 'DESCRIPTION', COL.desc, y + 5.6, 0.28);
  spaced(doc, 'HRS/QTY', COL.qty, y + 5.6, 0.28, 'right');
  spaced(doc, 'RATE', COL.rate, y + 5.6, 0.28, 'right');
  spaced(doc, `AMOUNT (${clean(v.symbol)})`, COL.amt, y + 5.6, 0.28, 'right');
  return y + 8.5;
}

// a block of contact lines: [text, url?]; returns the y under the last line
function contact(doc, x, y, width, name, lines) {
  font(doc, 'Lexend', 'bold', 10.5, C.ink);
  const nm = wrap(doc, name, width);
  doc.text(nm, x, y);
  y += nm.length * 4.8;
  font(doc, 'Lexend', 'normal', 8.6, C.soft);
  for (const [text, url] of lines) {
    if (!text) continue;
    const ls = wrap(doc, text, width);
    doc.text(ls, x, y);
    if (url && ls.length === 1) doc.link(x, y - 3.2, doc.getTextWidth(ls[0]), 4.2, { url });
    y += ls.length * 4.25;
  }
  return y;
}

function amountBox(doc, v, x, y, w) {
  const h = 34;
  const tone = v.st === 'paid' ? [C.okSoft, C.ok] : v.st === 'void' ? [C.badSoft, C.bad] : [C.goldSoft, null];
  doc.setFillColor(...tone[0]);
  doc.rect(x, y, w, h, 'F');
  if (tone[1]) { doc.setFillColor(...tone[1]); doc.rect(x, y, w, 1.1, 'F'); } else goldBar(doc, x, y, w, 1.1);
  label(doc, v.st === 'paid' ? 'PAID IN FULL' : v.st === 'void' ? 'VOID' : 'AMOUNT DUE', x + 5, y + 8, tone[1] || C.muted);
  const amt = clean(v.amountDue);
  doc.setFont('Lexend', 'bold');
  const size = fit(doc, amt, w - 10, 19, 11);
  font(doc, 'Lexend', 'bold', size, v.st === 'void' ? C.muted : C.ink);
  doc.text(amt, x + w - 5, y + 20, { align: 'right' });
  if (v.st === 'void') { const tw = doc.getTextWidth(amt); doc.setDrawColor(...C.bad); doc.setLineWidth(0.5); doc.line(x + w - 5 - tw, y + 17.2, x + w - 5, y + 17.2); }
  font(doc, 'Lexend', 'normal', 7.6, C.muted);
  const sub = v.st === 'paid' ? (v.paidOn ? 'Paid ' + v.paidOn : v.cur) : v.st === 'void' ? 'This invoice was cancelled' : [v.cur, v.dueLong].filter(Boolean).join(' · ');
  doc.text(wrap(doc, sub, w - 10).slice(0, 2), x + w - 5, y + 26.5, { align: 'right' });
  return y + h;
}

function metaRow(doc, v, y) {
  const cells = [['INVOICE NO.', v.number], ['ISSUED', v.issued], ['DUE', v.due]];
  if (v.period) cells.push(['WORK PERIOD', v.period]);
  if (v.ref) cells.push(['REFERENCE', v.ref]);
  const cw = (R - L) / cells.length;
  hair(doc, y);
  let tall = 0;
  cells.forEach(([k, val], i) => {
    const x = L + i * cw;
    label(doc, k, x, y + 5.8);
    font(doc, 'Lexend', 'bold', 9.2, C.ink);
    const ls = wrap(doc, val || '-', cw - 4);
    doc.text(ls, x, y + 11);
    tall = Math.max(tall, ls.length);
  });
  const end = y + 14.5 + (tall - 1) * 4.4;
  hair(doc, end);
  return end;
}

function payBlockHeight(doc, v, width) {
  let h = 0;
  if (v.pay.url) h += 15;
  font(doc, 'Lexend', 'normal', 8.6, C.soft);
  if (v.pay.paypalEmail) h += wrap(doc, 'PayPal: ' + v.pay.paypalEmail, width).length * 4.25 + 1;
  if (v.pay.bank) h += wrap(doc, v.pay.bank, width).length * 4.25 + 1.5;
  if (v.pay.note) h += wrap(doc, v.pay.note, width).length * 4.25;
  return h ? h + 7 : 0;
}
function payBlock(doc, v, x, y, width) {
  label(doc, 'HOW TO PAY', x, y);
  y += 5;
  if (v.pay.url) {
    const t = clean(v.pay.label);
    font(doc, 'Lexend', 'bold', 9.6, C.ink);
    const bw = Math.min(width, doc.getTextWidth(t) + 16);
    goldBar(doc, x, y, bw, 10);
    doc.text(t, x + bw / 2, y + 6.6, { align: 'center' });
    doc.link(x, y, bw, 10, { url: v.pay.url });
    y += 15;
  }
  font(doc, 'Lexend', 'normal', 8.6, C.soft);
  if (v.pay.paypalEmail) {
    const ls = wrap(doc, 'PayPal: ' + v.pay.paypalEmail, width);
    doc.text(ls, x, y + 1);
    if (ls.length === 1 && looksLikeEmail(v.pay.paypalEmail)) {
      const lead = doc.getTextWidth('PayPal: ');
      doc.link(x + lead, y - 2.2, doc.getTextWidth(ls[0]) - lead, 4.2, { url: mailto(v.pay.paypalEmail) });
    }
    y += ls.length * 4.25 + 1;
  }
  if (v.pay.bank) { const ls = wrap(doc, v.pay.bank, width); doc.text(ls, x, y + 1); y += ls.length * 4.25 + 1.5; }
  if (v.pay.note) { font(doc, 'Lexend', 'normal', 8.6, C.muted); const ls = wrap(doc, v.pay.note, width); doc.text(ls, x, y + 1); y += ls.length * 4.25; }
  return y;
}

// each totals row's label, wrapped to the room left of its amount
function totalsRows(doc, v, x) {
  const lx = x + 4, rx = R - 3;
  return v.rows.map(([k, val]) => {
    font(doc, 'Mono', 'normal', 8.8, C.ink);
    const vw = doc.getTextWidth(clean(val));
    font(doc, 'Lexend', 'normal', 8.8, C.muted);
    return { lines: wrap(doc, k, Math.max(20, rx - vw - 4 - lx)), val: clean(val) };
  });
}
function totalsHeight(doc, v, x) {
  return totalsRows(doc, v, x).reduce((t, r) => t + 6.2 + (r.lines.length - 1) * 4.2, 0) + 5 + 10 + (v.paid ? 13 : 0);
}
function totals(doc, v, x, y) {
  const lx = x + 4, rx = R - 3;
  for (const r of totalsRows(doc, v, x)) {
    font(doc, 'Lexend', 'normal', 8.8, C.muted);
    doc.text(r.lines, lx, y + 4, { lineHeightFactor: 1.35 });
    font(doc, 'Mono', 'normal', 8.8, C.ink);
    doc.text(r.val, rx, y + 4, { align: 'right' });
    y += 6.2 + (r.lines.length - 1) * 4.2;
  }
  y += 1.5;
  goldBar(doc, x, y, R - x, 0.9);
  y += 9.5;
  font(doc, 'Lexend', 'bold', 11, C.ink);
  doc.text('Total', lx, y);
  font(doc, 'Lexend', 'normal', 7.6, C.muted);
  const code = clean(v.cur);
  const cw = doc.getTextWidth(code);
  doc.text(code, rx, y, { align: 'right' });
  doc.setFont('Lexend', 'bold');
  const tot = clean(v.total);
  const size = fit(doc, tot, rx - cw - 2 - lx - 18, 16, 10);
  font(doc, 'Lexend', 'bold', size, C.ink);
  doc.text(tot, rx - cw - 1.6, y + 0.3, { align: 'right' });
  if (v.paid) {
    y += 7;
    font(doc, 'Lexend', 'normal', 8.8, C.muted);
    doc.text('Paid', lx, y);
    font(doc, 'Mono', 'normal', 8.8, C.ink);
    doc.text('-' + clean(v.paid), rx, y, { align: 'right' });
    y += 6;
    font(doc, 'Lexend', 'bold', 9.6, C.ink);
    doc.text('Balance due', lx, y);
    font(doc, 'Mono', 'bold', 9.6, C.ink);
    doc.text(clean(v.balance), rx, y, { align: 'right' });
  }
  return y + 2;
}

function draw(doc, a, v) {
  header(doc, a, v);
  // a running y position that starts a new page when it runs out of room
  const f = {
    y: 0,
    need(space, withHead) {
      if (this.y + space <= BOTTOM) return false;
      doc.addPage();
      slimHeader(doc, a, v);
      this.y = 31;
      if (withHead) this.y = tableHead(doc, this.y, v);
      return true;
    },
  };

  // from, bill to, amount due
  const top = 60;
  label(doc, 'FROM', L, top - 5);
  label(doc, 'BILL TO', 78, top - 5);
  const b = v.business;
  const yFrom = contact(doc, L, top + 1, 56, b.name, [
    [b.address], [b.phone],
    [b.email, looksLikeEmail(b.email) ? mailto(b.email) : ''],
    [b.website, looksLikeSite(b.website) ? webUrl(b.website) : ''],
  ]);
  const t = v.billTo;
  const yTo = contact(doc, 78, top + 1, 52, t.name || t.company || 'Client', [
    [t.name && t.company ? t.company : ''], [t.address],
    [t.email, looksLikeEmail(t.email) ? mailto(t.email) : ''],
  ]);
  const yBox = amountBox(doc, v, 136, top - 9, R - 136);
  f.y = Math.max(yFrom, yTo, yBox) + 6;

  f.y = metaRow(doc, v, f.y) + 8;

  // items
  f.y = tableHead(doc, f.y, v);
  font(doc, 'Lexend', 'normal', 9.4, C.ink);
  const rows = v.lines.length ? v.lines : [{ n: '', desc: 'No items yet', qty: '', price: '', amount: '' }];
  for (const l of rows) {
    font(doc, 'Lexend', 'normal', 9.4, C.ink);
    const ls = wrap(doc, l.desc, DESC_W);
    const h = 6.4 + (ls.length - 1) * 4.5 + 4.4;
    f.need(h, true);
    const y = f.y + 6.4;
    font(doc, 'Mono', 'normal', 8.4, C.muted);
    doc.text(String(l.n), COL.n, y);
    font(doc, 'Lexend', 'normal', 9.4, C.ink);
    doc.text(ls, COL.desc, y, { lineHeightFactor: 1.36 });
    font(doc, 'Mono', 'normal', 9, C.ink);
    doc.text(clean(l.qty), COL.qty, y, { align: 'right' });
    doc.text(clean(l.price), COL.rate, y, { align: 'right' });
    font(doc, 'Mono', 'bold', 9, C.ink);
    doc.text(clean(l.amount), COL.amt, y, { align: 'right' });
    f.y += h;
    hair(doc, f.y);
  }

  // how to pay (left) and the totals (right)
  const showPay = v.st !== 'paid' && v.st !== 'void';
  const payW = 100 - L;
  const ph = showPay ? payBlockHeight(doc, v, payW) : 0;
  f.need(Math.max(ph, totalsHeight(doc, v, 116)) + 8);
  f.y += 6;
  const y0 = f.y;
  const yT = totals(doc, v, 116, y0);
  const yP = ph ? payBlock(doc, v, L, y0 + 4, payW) : y0;
  f.y = Math.max(yT, yP) + 6;

  // note and terms
  for (const [k, text] of [['NOTE', v.note], ['TERMS', v.terms]]) {
    if (!text) continue;
    font(doc, 'Lexend', 'normal', 8.6, C.soft);
    const ls = wrap(doc, text, R - L);
    f.need(12 + Math.min(ls.length, 3) * 4.25);
    hair(doc, f.y);
    f.y += 6.5;
    label(doc, k, L, f.y);
    f.y += 5;
    font(doc, 'Lexend', 'normal', 8.6, C.soft);
    for (const line of ls) {
      if (f.need(4.25)) font(doc, 'Lexend', 'normal', 8.6, C.soft);
      doc.text(line, L, f.y);
      f.y += 4.25;
    }
    f.y += 2;
  }
}

/* ---------- public ---------- */

async function invoice(v) {
  const a = await loadAssets();
  const doc = newDoc(a, v);
  draw(doc, a, v);
  footers(doc, v);
  return doc;
}
window.InvoicePDF = { invoice };
})();
