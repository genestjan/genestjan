import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { importBills, importStatement } from '../lib/actions';
import { findHeader, parseBillsMatrix, parseCSV, toDrafts, type BillDraft, type Draft } from '../lib/csv';
import { INSTITUTIONS, isLiability } from '../lib/model';
import { formatMoney } from '../lib/money';
import { toast, useApp } from '../lib/session';
import { useUI } from '../ui-state';
import { ErrorText, Field, Sheet } from './ui';

async function readFile(file: File): Promise<string> {
  return file.text();
}

export function ImportSheet() {
  const kind = useUI((s) => s.importer);
  if (!kind) return null;
  return kind === 'statement' ? <StatementImport /> : <BillsImport />;
}

const close = () => useUI.setState({ importer: null });

function StatementImport() {
  const snap = useApp((s) => s.snap)!;
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    const rows = parseCSV(await readFile(file));
    const header = findHeader(rows);
    if (!header) { setError('Could not find the date and amount columns. Download the statement as CSV and try again.'); return; }
    const res = toDrafts(rows, header);
    setDrafts(res.drafts);
    setSkipped(res.skipped);
    const name = file.name.toLowerCase();
    const inst = INSTITUTIONS.find((i) => i.words.test(name))?.id;
    const guess = snap.accounts.find((a) => !a.archived && a.institution === inst);
    if (guess) setAccountId(guess.id);
  }

  const inflow = drafts?.filter((d) => d.amount > 0).reduce((s, d) => s + d.amount, 0) ?? 0;
  const outflow = drafts?.filter((d) => d.amount < 0).reduce((s, d) => s - d.amount, 0) ?? 0;
  const acct = snap.accounts.find((a) => a.id === accountId);

  return (
    <Sheet open onClose={close} title="Import a statement"
      footer={<button className="btn-primary w-full" disabled={!drafts?.length || !acct} onClick={async () => {
        try {
          const r = await importStatement(drafts!, acct!);
          toast(`${r.added} added${r.duplicates ? `, ${r.duplicates} already there` : ''}.`);
          close();
        } catch (e) { setError((e as Error).message); }
      }}>Import {drafts?.length ? `${drafts.length} transactions` : ''}</button>}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          For anything the phone did not capture: bank, credit card, GCash, PayPal (Activity, download as CSV) or Wise (Statements, CSV).
          Already-imported rows are skipped, so importing the same file twice is safe.
        </p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-7 text-center hover:bg-ink-4">
          <FileSpreadsheet className="text-current" />
          <span className="text-sm font-medium">Choose a CSV file</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void pick(e.target.files[0])} />
        </label>
        {drafts && (
          <div className="rounded-xl border border-line bg-ink-3 p-3 text-sm">
            <p><span className="font-semibold">{drafts.length}</span> transactions found{skipped ? `, ${skipped} rows skipped (pending, holds or blank)` : ''}.</p>
            {drafts.length > 0 && (
              <p className="mt-1 text-muted">
                {drafts[drafts.length - 1].date} to {drafts[0].date} · in <span className="num text-income">{formatMoney(inflow, acct?.currency)}</span> · out <span className="num text-expense">{formatMoney(outflow, acct?.currency)}</span>
              </p>
            )}
          </div>
        )}
        <Field label="Which account is this statement for?">
          <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Choose an account</option>
            {snap.accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}

function BillsImport() {
  const snap = useApp((s) => s.snap)!;
  const [bills, setBills] = useState<(BillDraft & { on: boolean })[] | null>(null);
  const [payFromId, setPayFromId] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    const found = parseBillsMatrix(parseCSV(await readFile(file)));
    if (!found.length) { setError('No month columns found. Open the Budgeting tab, then File > Download > Comma-separated values (.csv).'); return; }
    setBills(found.map((b) => ({ ...b, on: true })));
  }

  return (
    <Sheet open onClose={close} title="Import bills from your Google Sheet" wide
      footer={<button className="btn-primary w-full" disabled={!bills?.some((b) => b.on)} onClick={async () => {
        try {
          const r = await importBills(bills!.filter((b) => b.on), { payFromId: payFromId || undefined });
          toast(`${r.bills} bills added${r.cards ? `, ${r.cards} credit cards created` : ''}.`);
          close();
        } catch (e) { setError((e as Error).message); }
      }}>Import selected bills</button>}>
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted">
          <li>Open your budget sheet and click the <span className="text-paper">Budgeting</span> tab.</li>
          <li>Click <span className="text-paper">File</span>, then <span className="text-paper">Download</span>, then <span className="text-paper">Comma-separated values (.csv)</span>.</li>
          <li>Choose that file below. Each row becomes a bill with its monthly amounts and due day. Rows with Visa or Mastercard become credit cards too.</li>
        </ol>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center hover:bg-ink-4">
          <FileSpreadsheet className="text-current" />
          <span className="text-sm font-medium">Choose the Budgeting CSV</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && void pick(e.target.files[0])} />
        </label>
        {bills && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {bills.map((b, i) => (
              <li key={b.name + i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={b.on} className="h-4 w-4 accent-[#FFB03A]"
                  onChange={(e) => setBills((xs) => xs!.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                <span className="min-w-0 flex-1 truncate">{b.name}{b.isCard && <span className="ml-2 chip bg-current/15 text-current">Card</span>}</span>
                <span className="num text-muted">{formatMoney(b.amount)}</span>
                <span className="w-16 text-right text-xs text-faint">due {b.dueDay}</span>
              </li>
            ))}
          </ul>
        )}
        <Field label="Usually paid from (optional)">
          <select className="field" value={payFromId} onChange={(e) => setPayFromId(e.target.value)}>
            <option value="">Decide each time</option>
            {snap.accounts.filter((a) => !isLiability(a) && !a.archived).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <ErrorText>{error}</ErrorText>
      </div>
    </Sheet>
  );
}
