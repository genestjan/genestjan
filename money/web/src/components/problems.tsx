import { Copy, RotateCw } from 'lucide-react';
import { Component, useState, type ReactNode } from 'react';
import { cloudConfig } from '../lib/cloud';
import { ago } from '../lib/dates';
import { appTag, clearProblems, copyText, describeError, logProblem, problemReport, useProblems } from '../lib/problems';
import { Card, Logo } from './ui';

/** Settings: what went wrong on this device lately, ready to copy into a message. */
export function ProblemsCard() {
  const list = useProblems();
  const [copied, setCopied] = useState(false);
  return (
    <Card title="Problems on this device"
      action={list.length > 0 && <button className="text-xs text-muted hover:text-paper" onClick={() => { clearProblems(); setCopied(false); }}>Clear</button>}>
      {list.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">Nothing has gone wrong. If something does, it is listed here with the exact details to send.</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {list.slice(0, 5).map((p) => (
              <li key={`${p.at}-${p.where}`} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{p.where}</span>
                  <span className="shrink-0 text-xs text-faint">{ago(p.at)}{p.count > 1 ? ` · ${p.count} times` : ''}</span>
                </div>
                <p className="text-sm text-expense">{p.message}</p>
                {p.detail && <p className="mt-0.5 break-words font-mono text-[11px] leading-snug text-muted">{p.detail}</p>}
              </li>
            ))}
          </ul>
          <button className="btn-outline mt-3 w-full text-sm" onClick={async () => setCopied(await copyText(problemReport(list, cloudConfig()?.url)))}>
            <Copy size={16} /> {copied ? 'Copied. Paste it into your message.' : 'Copy the problem report'}
          </button>
        </>
      )}
    </Card>
  );
}

function CrashScreen({ error }: { error: unknown }) {
  const { message, detail } = describeError(error);
  const [copied, setCopied] = useState(false);
  const tech = `${detail ? `${detail} · ` : ''}${appTag()}`;
  return (
    <div className="grid min-h-full place-items-center bg-ink px-6 py-10">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center"><Logo size={56} /></div>
        <h1 className="mt-4 font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your saved data is not affected. Take a screenshot of this screen and send it, or copy the details. Then tap Reload.
        </p>
        <div role="alert" className="mt-5 rounded-xl border border-expense/30 bg-expense/10 p-3.5 text-left text-sm text-expense">
          <p>{message}</p>
          <p className="mt-1.5 break-words font-mono text-[11px] leading-snug text-expense/75">{tech}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="btn-outline" onClick={async () => setCopied(await copyText(`Money Hub crashed\n${message}\n${tech}`))}>
            <Copy size={16} /> {copied ? 'Copied' : 'Copy details'}
          </button>
          <button className="btn-primary" onClick={() => location.reload()}><RotateCw size={16} /> Reload</button>
        </div>
      </div>
    </div>
  );
}

/** Shows what broke instead of a blank screen, and writes it down for the problem report. */
export class CrashGuard extends Component<{ children: ReactNode }, { crashed: boolean; error: unknown }> {
  state = { crashed: false, error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { crashed: true, error };
  }

  componentDidCatch(error: unknown) {
    logProblem('Screen crashed', error);
  }

  render() {
    return this.state.crashed ? <CrashScreen error={this.state.error} /> : this.props.children;
  }
}
