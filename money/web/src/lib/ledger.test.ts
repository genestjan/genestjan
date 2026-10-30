import { dataKey } from './crypto';
import { memoryDB } from './db';
import { Ledger, type Remote, type RemoteRow } from './ledger';
import type { Txn } from './model';

/** A stand-in for the Supabase table: rows keyed by id, each write gets the next sequence. */
function fakeServer() {
  const rows = new Map<string, RemoteRow>();
  let seq = 0;
  const remote: Remote = {
    pull: async (after, limit) => [...rows.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq).slice(0, limit),
    push: async (batch) => { for (const r of batch) rows.set(r.id, { ...r, seq: ++seq }); },
  };
  return { remote, rows };
}

const txn = (id: string, amount: number): Txn => ({
  id, kind: 'txn', updatedAt: 0, type: 'expense', date: '2026-10-30', amount, accountId: 'a', source: 'manual',
});

async function device(key: CryptoKey) {
  const l = new Ledger(memoryDB(), key);
  await l.load();
  return l;
}

describe('Ledger sync between two devices', () => {
  it('copies changes across and keeps only ciphertext on the server', async () => {
    const key = await dataKey(crypto.getRandomValues(new Uint8Array(32)));
    const { remote, rows } = fakeServer();
    const phone = await device(key);
    const laptop = await device(key);

    await phone.put([txn('t1', 25_000)], 1000);
    expect(await phone.sync(remote)).toEqual({ pulled: 0, pushed: 1 });
    expect([...rows.values()][0].ct).not.toContain('25000');

    expect((await laptop.sync(remote)).pulled).toBe(1);
    expect(laptop.get<Txn>('t1')?.amount).toBe(25_000);

    await laptop.remove(['t1'], 2000);
    await laptop.sync(remote);
    await phone.sync(remote);
    expect(phone.get('t1')).toBeUndefined();
    expect(phone.dirty()).toHaveLength(0);
  });

  it('keeps the newer edit when both devices changed the same record offline', async () => {
    const key = await dataKey(crypto.getRandomValues(new Uint8Array(32)));
    const { remote } = fakeServer();
    const phone = await device(key);
    const laptop = await device(key);
    await phone.put([txn('t1', 100)], 1000);
    await phone.sync(remote);
    await laptop.sync(remote);

    await laptop.put([{ ...laptop.get<Txn>('t1')!, amount: 200 }], 3000); // newer
    await phone.put([{ ...phone.get<Txn>('t1')!, amount: 300 }], 2000); // older, but uploads last
    await laptop.sync(remote);
    await phone.sync(remote);
    await laptop.sync(remote);
    await phone.sync(remote);
    expect(phone.get<Txn>('t1')?.amount).toBe(200);
    expect(laptop.get<Txn>('t1')?.amount).toBe(200);
  });

  it('survives a restart: records come back from disk still encrypted', async () => {
    const key = await dataKey(crypto.getRandomValues(new Uint8Array(32)));
    const db = memoryDB();
    const a = new Ledger(db, key);
    await a.load();
    await a.put([txn('t9', 999)]);
    expect(JSON.stringify(await db.all())).not.toContain('999,');
    const b = new Ledger(db, key);
    expect(await b.load()).toEqual({ unreadable: 0 });
    expect(b.get<Txn>('t9')?.amount).toBe(999);
    const wrong = new Ledger(db, await dataKey(crypto.getRandomValues(new Uint8Array(32))));
    expect(await wrong.load()).toEqual({ unreadable: 1 });
  });
});
