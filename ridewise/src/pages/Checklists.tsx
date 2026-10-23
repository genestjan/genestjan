import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import type { ChecklistItemState, ChecklistKind } from '../types';
import { checklistKey, useActivePlan, useStore } from '../store/store';
import { CHECKLISTS, CRITICAL_MESSAGE, progress } from '../lib/checklists';
import { Card, Notice, PageTitle, Progress, confirmAction } from '../components/ui';

const KINDS: ChecklistKind[] = ['pre-ride', 'pit-stop', 'post-ride'];

export default function Checklists() {
  const [params, setParams] = useSearchParams();
  const kind = (KINDS.includes(params.get('kind') as ChecklistKind) ? params.get('kind') : 'pre-ride') as ChecklistKind;
  const stopId = params.get('stop') ?? undefined;
  const plan = useActivePlan();
  const key = checklistKey(kind, plan?.id, kind === 'pit-stop' ? stopId : undefined);
  const record = useStore((s) => s.checklists[key]);
  const custom = useStore((s) => s.customItems[kind]);
  const setState = useStore((s) => s.setChecklistState);
  const reset = useStore((s) => s.resetChecklist);
  const addCustom = useStore((s) => s.addCustomItem);
  const removeCustom = useStore((s) => s.removeCustomItem);
  const [newItem, setNewItem] = useState('');

  const def = CHECKLISTS[kind];
  const items = [...def.items, ...custom];
  const states = record?.states ?? {};
  const p = progress(items, states);
  const stop = plan?.stops.find((s) => s.id === stopId);

  const set = (id: string, st: ChecklistItemState) => setState(key, kind, id, states[id] === st ? 'todo' : st, plan?.id, stopId);

  return (
    <div className="space-y-4">
      <PageTitle title="Bicycle Checklists" subtitle={plan ? `For: ${plan.name}${stop ? ` · at ${stop.place.name}` : ''}` : 'General checklist (no plan open)'} />
      <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Checklist type">
        {KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={k === kind} className={`rounded-lg px-2 py-2 text-sm font-semibold ${k === kind ? 'bg-navy text-white' : 'bg-slate-200 text-slate-700'}`} onClick={() => setParams(stopId && k === 'pit-stop' ? { kind: k, stop: stopId } : { kind: k })}>
            {CHECKLISTS[k].title.replace(' inspection', '').replace(' check', '')}
          </button>
        ))}
      </div>
      <Card className="space-y-3">
        <div>
          <h2 className="font-bold text-navy">{def.title}</h2>
          <p className="text-sm text-slate-600">{def.intro}</p>
        </div>
        <Progress pct={p.pct} label={`${p.done} of ${p.total} checked`} />
        {p.criticalProblems.length > 0 && (
          <Notice level="danger" title={`Safety problem: ${p.criticalProblems.map((i) => i.label).join('; ')}`}>
            {CRITICAL_MESSAGE}
          </Notice>
        )}
        {p.problems.length > p.criticalProblems.length && <Notice level="caution" title="Some items need attention. Sort them out before the next stretch if you can." />}
        <ul className="divide-y divide-slate-100">
          {items.map((i) => {
            const st = states[i.id] ?? 'todo';
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm">
                  {i.label}
                  {i.critical && <span className="ml-1 text-xs font-semibold text-slate-500">(safety-critical)</span>}
                  <span className="sr-only">, status {st === 'ok' ? 'OK' : st === 'problem' ? 'problem' : 'not checked'}</span>
                </span>
                <button type="button" aria-pressed={st === 'ok'} aria-label={`${i.label}: OK`} className={`btn min-h-[44px] border px-3 ${st === 'ok' ? 'border-go bg-go text-white' : 'border-slate-300 bg-white'}`} onClick={() => set(i.id, 'ok')}>
                  <Check aria-hidden className="h-4 w-4" /> OK
                </button>
                <button type="button" aria-pressed={st === 'problem'} aria-label={`${i.label}: problem`} className={`btn min-h-[44px] border px-3 ${st === 'problem' ? 'border-danger bg-danger text-white' : 'border-slate-300 bg-white'}`} onClick={() => set(i.id, 'problem')}>
                  <TriangleAlert aria-hidden className="h-4 w-4" /> Problem
                </button>
                {i.custom && (
                  <button type="button" className="btn-ghost min-h-[44px] px-2" aria-label={`Delete custom item ${i.label}`} onClick={() => confirmAction(`Delete "${i.label}"?`) && removeCustom(kind, i.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newItem.trim()) { addCustom(kind, newItem.trim()); setNewItem(''); } }}>
          <label htmlFor="new-item" className="sr-only">New checklist item</label>
          <input id="new-item" className="input" placeholder="Add your own item" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <button type="submit" className="btn-secondary" disabled={!newItem.trim()}><Plus aria-hidden className="h-4 w-4" />Add</button>
        </form>
        <button type="button" className="btn-ghost" onClick={() => confirmAction('Clear all ticks on this checklist?') && reset(key)}>
          <RotateCcw aria-hidden className="h-4 w-4" /> Reset checklist
        </button>
      </Card>
      {plan?.bike.tirePressureNote && <Notice level="info" title={`Your tyre pressure note: ${plan.bike.tirePressureNote}`} />}
    </div>
  );
}
