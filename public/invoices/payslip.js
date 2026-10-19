/* Payslip and payroll summary PDFs for the Payroll tab of Work Hub, drawn with jsPDF (moved over
   from the Partner Payroll app unchanged). Loaded the first time a payslip is asked for. A4, mm. */
(() => {
'use strict';

const W = 210, L = 16, R = 194, BOTTOM = 272;
const C = {
  band: [35, 35, 35], ink: [29, 29, 28], muted: [103, 101, 95], line: [227, 225, 219],
  goldInk: [138, 98, 25], goldSoft: [248, 242, 226], white: [255, 255, 255],
  bandMuted: [190, 188, 182], bandGold: [226, 192, 113],
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

function newDoc(a, title) {
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
  for (const [n, b64] of Object.entries(a.fonts)) doc.addFileToVFS(n + '.ttf', b64);
  doc.addFont('Lexend-Regular.ttf', 'Lexend', 'normal');
  doc.addFont('Lexend-SemiBold.ttf', 'Lexend', 'bold');
  doc.addFont('PlexMono-Regular.ttf', 'Mono', 'normal');
  doc.addFont('PlexMono-SemiBold.ttf', 'Mono', 'bold');
  doc.setProperties({ title, author: 'Genest Jan Ramirez', creator: 'Work Hub' });
  return doc;
}

/* ---------- drawing helpers ---------- */

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
function hair(doc, y) { doc.setDrawColor(...C.line); doc.setLineWidth(0.25); doc.line(L, y, R, y); }
function label(doc, text, x, y) { font(doc, 'Mono', 'bold', 7.2, C.muted); spaced(doc, text, x, y, 0.3); }
function tag(doc, text, xr, y) {
  font(doc, 'Mono', 'bold', 6.4, C.goldInk);
  const w = doc.getTextWidth(text) + 0.25 * (text.length - 1);
  doc.setFillColor(...C.goldSoft);
  doc.roundedRect(xr - w - 4, y - 3.6, w + 4, 5, 1.2, 1.2, 'F');
  doc.text(text, xr - w - 2, y - 0.2, { charSpace: 0.25 });
}
function initials(name) { return String(name).split(/\s+/).filter(Boolean).map(w => w[0]).join('').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4) || 'X'; }
const compact = s => String(s || '').replace(/-/g, '');

function header(doc, a, kind, ref, ctx, h) {
  doc.setFillColor(...C.band);
  doc.rect(0, 0, W, 40, 'F');
  goldBar(doc, 0, 40, W, 1.3);
  doc.addImage(a.mark, 'PNG', L - 1, 7.5, 25, 25);
  font(doc, 'Lexend', 'bold', 16, C.white);
  doc.text('Genest Jan Ramirez', L + 29, 19);
  font(doc, 'Lexend', 'normal', 9, C.bandMuted);
  doc.text('Connect, Engage, Succeed', L + 29, 25.5);
  font(doc, 'Lexend', 'bold', 8.5, C.bandGold);
  spaced(doc, kind, R, 16.5, 0.45, 'right');
  font(doc, 'Lexend', 'normal', 9, C.white);
  doc.text('Pay date: ' + h.longDate(h.parseIso(ctx.run.payDate)), R, 23, { align: 'right' });
  font(doc, 'Mono', 'normal', 7.5, C.bandMuted);
  doc.text(ref, R, 28.5, { align: 'right' });
}

function footers(doc, ctx, h) {
  const n = doc.internal.getNumberOfPages();
  const d = ctx.generatedAt;
  const when = h.longDate(d) + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const by = ['Prepared by ' + (ctx.settings.preparedBy || 'Genest Jan Ramirez'), ctx.settings.location].filter(Boolean).join(' · ');
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    hair(doc, 283);
    font(doc, 'Lexend', 'normal', 7.6, C.muted);
    doc.text(by, L, 288.5);
    doc.text(n > 1 ? `Generated ${when} · Page ${i} of ${n}` : `Generated ${when}`, R, 288.5, { align: 'right' });
  }
}

function totalBox(doc, text, amount, y) {
  const x = 124, w = R - x, hgt = 27;
  doc.setFillColor(...C.goldSoft);
  doc.rect(x, y, w, hgt, 'F');
  goldBar(doc, x, y, w, 1);
  label(doc, text, x + 5, y + 8);
  font(doc, 'Lexend', 'bold', 18, C.ink);
  doc.text(amount, R - 5, y + 18, { align: 'right' });
  font(doc, 'Lexend', 'normal', 7.5, C.muted);
  doc.text('Philippine pesos', R - 5, y + 23.2, { align: 'right' });
}

function tableHead(doc, y, cols) {
  doc.setFillColor(...C.band);
  doc.rect(L, y, R - L, 8, 'F');
  font(doc, 'Mono', 'bold', 6.8, C.white);
  for (const [t, x, align] of cols) spaced(doc, t, x, y + 5.3, 0.28, align);
}

function row(doc, y, name, comp, amount, bold) {
  font(doc, 'Lexend', bold ? 'bold' : 'normal', 9.5, C.ink);
  doc.text(name, L, y);
  if (comp) { font(doc, 'Mono', 'normal', 8.8, C.muted); doc.text(comp, 64, y); }
  if (amount) { font(doc, 'Mono', bold ? 'bold' : 'normal', 9.5, C.ink); doc.text(amount, R - 2, y, { align: 'right' }); }
}

// a running y position that starts a new page (with the same header) when it runs out of room
function flow(doc, a, kind, ref, ctx, h) {
  return {
    y: 0,
    need(space) {
      if (this.y + space <= BOTTOM) return;
      doc.addPage();
      header(doc, a, kind, ref, ctx, h);
      this.y = 54;
    },
  };
}

/* ---------- pages ---------- */

function partnerPage(doc, a, slip, ctx, h) {
  const run = ctx.run;
  const per = h.periodText(h.parseIso(run.start), h.parseIso(run.end), ' – ');
  const ref = `PAY-${compact(run.payDate)}-${initials(slip.partner.name)}`;
  const kind = 'SALARY STATEMENT';
  header(doc, a, kind, ref, ctx, h);
  const f = flow(doc, a, kind, ref, ctx, h);

  label(doc, 'PAID TO', L, 57);
  font(doc, 'Lexend', 'bold', 20, C.ink);
  doc.text(doc.splitTextToSize(slip.partner.name, 100)[0], L, 66);
  font(doc, 'Lexend', 'normal', 9.5, C.muted);
  doc.text('Pay period: ' + per, L, 73);
  totalBox(doc, 'TOTAL PAY', h.peso(slip.total), 49);

  tableHead(doc, 86, [['DESCRIPTION', L + 3, 'left'], ['COMPUTATION', 64, 'left'], ['AMOUNT', R - 2, 'right']]);
  f.y = 94;
  const many = slip.blocks.length > 1;
  for (const b of slip.blocks) {
    f.need(9 + (b.hourly ? 13 : 0) + (b.commission ? 6.5 : 0) + (many ? 6.5 : 0) + 5);
    f.y += 9;
    font(doc, 'Lexend', 'bold', 11.5, C.ink);
    doc.text(b.client.name, L, f.y);
    const x = L + doc.getTextWidth(b.client.name) + 3;
    font(doc, 'Lexend', 'normal', 8.5, C.muted);
    doc.text([b.client.about, per].filter(Boolean).join(' · '), x, f.y);
    if (b.commission) tag(doc, 'WITH COMMISSION', R, f.y);
    if (b.hourly) {
      const hr = b.hourly;
      f.y += 7;
      row(doc, f.y, 'Hours worked', `${hr.hm} = ${hr.hours.toFixed(2)} hours`, '');
      f.y += 6.5;
      row(doc, f.y, 'Hourly pay', `${hr.hours.toFixed(2)} h × ${h.usdRate(hr.rate)}/hr × ₱${h.money(hr.fx)}/USD`, h.peso(hr.php));
    }
    if (b.commission) {
      const c = b.commission;
      f.y += 6.5;
      row(doc, f.y, 'Commission', `${h.CUR[c.cur].sym}${h.money(c.amount)} × ₱${h.money(c.fx)}/${c.cur} ÷ ${c.split}`, h.peso(c.php));
    }
    if (many) { f.y += 6.5; row(doc, f.y, 'Subtotal', '', h.peso(b.subtotal), true); }
    f.y += 4.5;
    hair(doc, f.y);
  }

  f.need(26);
  f.y += 5;
  goldBar(doc, L, f.y, R - L, 0.9);
  f.y += 9;
  font(doc, 'Lexend', 'bold', 13, C.ink);
  doc.text('Total pay', L, f.y);
  font(doc, 'Lexend', 'bold', 16, C.ink);
  doc.text(h.peso(slip.total), R - 2, f.y + 0.5, { align: 'right' });
  if (slip.usdPay > 0) {
    f.y += 6.5;
    font(doc, 'Lexend', 'normal', 8.5, C.muted);
    doc.text(`Hourly pay in US dollars: $${h.money(slip.usdPay)} for ${slip.hours.toFixed(2)} hours. Partner rates are agreed in US dollars.`, L, f.y);
  }

}

function summaryPage(doc, a, ctx, h) {
  const run = ctx.run, R0 = ctx.R;
  const per = h.periodText(h.parseIso(run.start), h.parseIso(run.end), ' – ');
  const ref = `PAY-${compact(run.payDate)}`;
  const kind = 'PAYROLL SUMMARY';
  header(doc, a, kind, ref, ctx, h);
  const f = flow(doc, a, kind, ref, ctx, h);

  label(doc, 'PAY RUN', L, 57);
  font(doc, 'Lexend', 'bold', 20, C.ink);
  doc.text('Payroll summary', L, 66);
  font(doc, 'Lexend', 'normal', 9.5, C.muted);
  doc.text('Pay period: ' + per, L, 73);
  totalBox(doc, 'TOTAL PAYROLL', h.peso(R0.grand), 49);

  const X = { hours: 112, hourly: 141, comm: 167, total: R - 2 };
  tableHead(doc, 86, [['PARTNER', L + 3, 'left'], ['HOURS', X.hours, 'right'], ['HOURLY PAY', X.hourly, 'right'], ['COMMISSION', X.comm, 'right'], ['TOTAL', X.total, 'right']]);
  f.y = 94;
  for (const s of R0.active) {
    f.need(16);
    f.y += 8;
    font(doc, 'Lexend', 'bold', 10, C.ink);
    doc.text(doc.splitTextToSize(s.partner.name, X.hours - L - 16)[0], L, f.y);
    font(doc, 'Mono', 'normal', 9, C.ink);
    doc.text(s.hours.toFixed(2), X.hours, f.y, { align: 'right' });
    doc.text(s.hourlyPhp ? h.peso(s.hourlyPhp) : '–', X.hourly, f.y, { align: 'right' });
    doc.text(s.commPhp ? h.peso(s.commPhp) : '–', X.comm, f.y, { align: 'right' });
    font(doc, 'Mono', 'bold', 9, C.ink);
    doc.text(h.peso(s.total), X.total, f.y, { align: 'right' });
    f.y += 4.6;
    const parts = [];
    for (const b of s.blocks) {
      if (b.hourly) parts.push(`${b.client.name} ${b.hourly.hours.toFixed(2)} h`);
      if (b.commission) parts.push(`${b.client.name} commission`);
    }
    font(doc, 'Lexend', 'normal', 7.8, C.muted);
    doc.text(parts.join(' · '), L, f.y);
    f.y += 3.5;
    hair(doc, f.y);
  }
  f.need(20);
  f.y += 5;
  goldBar(doc, L, f.y, R - L, 0.9);
  f.y += 9;
  const hourlySum = R0.active.reduce((t, s) => t + (s.hourlyPhp || 0), 0);
  const commSum = R0.active.reduce((t, s) => t + (s.commPhp || 0), 0);
  font(doc, 'Lexend', 'bold', 12, C.ink);
  doc.text('Total payroll', L, f.y);
  font(doc, 'Mono', 'bold', 9, C.ink);
  doc.text(R0.hours.toFixed(2), X.hours, f.y, { align: 'right' });
  doc.text(h.peso(Math.round(hourlySum * 100) / 100), X.hourly, f.y, { align: 'right' });
  doc.text(commSum ? h.peso(Math.round(commSum * 100) / 100) : '–', X.comm, f.y, { align: 'right' });
  font(doc, 'Lexend', 'bold', 12, C.ink);
  doc.text(h.peso(R0.grand), X.total, f.y + 0.3, { align: 'right' });
}

/* ---------- public ---------- */

async function partner(slip, ctx, h) {
  const a = await loadAssets();
  const doc = newDoc(a, 'Payslip, ' + slip.partner.name + ', ' + ctx.run.payDate);
  partnerPage(doc, a, slip, ctx, h);
  footers(doc, ctx, h);
  return doc;
}
async function all(ctx, h) {
  const a = await loadAssets();
  const doc = newDoc(a, 'Payroll, ' + ctx.run.payDate);
  summaryPage(doc, a, ctx, h);
  for (const s of ctx.R.active) { doc.addPage(); partnerPage(doc, a, s, ctx, h); }
  footers(doc, ctx, h);
  return doc;
}
window.PayrollPDF = { partner, all };
})();
