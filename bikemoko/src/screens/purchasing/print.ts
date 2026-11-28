// Opens a small printable page. Used by pick-lists and purchase orders.
export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function printHtml(title: string, body: string) {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) throw new Error('Allow pop-ups to print');
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body{font-family:system-ui,sans-serif;padding:24px;color:#000}
h1{font-size:20px;margin:0 0 4px}p{margin:2px 0 12px;color:#444}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{border-bottom:1px solid #bbb;padding:6px 4px;text-align:left}
.r{text-align:right}</style></head><body>${body}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}
