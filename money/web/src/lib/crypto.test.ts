import {
  createVault, decryptJSON, deriveMaster, encryptJSON, dataKey, newCaptureKeys, newRecoveryKey,
  openCapture, openWithPassword, openWithRecovery, recoveryProof, rewrap, sealCapture, sha256Hex,
} from './crypto';

// Fewer PBKDF2 rounds keep the tests quick; the app always uses 600,000.
const FAST = 1000;

describe('account secrets', () => {
  it('derives the same login and key from the same password and email, on any device', async () => {
    const a = await deriveMaster('correct horse', 'Jan@Example.com ', FAST);
    const b = await deriveMaster('correct horse', 'jan@example.com', FAST);
    expect(a.auth).toBe(b.auth);
    expect(a.auth).toHaveLength(43);
    const c = await deriveMaster('correct horsf', 'jan@example.com', FAST);
    expect(c.auth).not.toBe(a.auth);
  });

  it('never sends the real password: the login secret is unrelated to it', async () => {
    const m = await deriveMaster('my password', 'jan@example.com', FAST);
    expect(m.auth).not.toContain('my password');
  });
});

describe('vault', () => {
  it('opens with the password and with the recovery key, and not with a wrong one', async () => {
    const master = await deriveMaster('pw-1', 'jan@example.com', FAST);
    const { dek, boxes, recoveryKey } = await createVault(master);
    expect(recoveryKey).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
    expect(await openWithPassword(master, boxes)).toEqual(dek);
    expect(await openWithRecovery(recoveryKey, boxes)).toEqual(dek);
    // typed in lower case with spaces still works
    expect(await openWithRecovery(recoveryKey.toLowerCase().replace(/-/g, ' '), boxes)).toEqual(dek);
    const wrong = await deriveMaster('pw-2', 'jan@example.com', FAST);
    await expect(openWithPassword(wrong, boxes)).rejects.toThrow(/does not open/);
    await expect(openWithRecovery(newRecoveryKey(), boxes)).rejects.toThrow(/does not open/);
  });

  it('keeps the same data key across a password change', async () => {
    const m1 = await deriveMaster('old', 'jan@example.com', FAST);
    const { dek, boxes } = await createVault(m1);
    const m2 = await deriveMaster('new', 'jan@example.com', FAST);
    const moved = { ...boxes, pw: await rewrap(dek, m2) };
    expect(await openWithPassword(m2, moved)).toEqual(dek);
  });

  it('stores only a hash of the recovery proof on the server', async () => {
    const master = await deriveMaster('pw', 'jan@example.com', FAST);
    const { boxes, recoveryKey } = await createVault(master);
    expect(boxes.rkCheck).toBe(await sha256Hex(await recoveryProof(recoveryKey)));
  });
});

describe('records', () => {
  it('round-trips a record and rejects tampering', async () => {
    const key = await dataKey(crypto.getRandomValues(new Uint8Array(32)));
    const box = await encryptJSON(key, { id: 'x', amount: 12345, payee: 'Jollibee' });
    expect(box.ct).not.toContain('Jollibee');
    expect(await decryptJSON(key, box)).toEqual({ id: 'x', amount: 12345, payee: 'Jollibee' });
    const bad = { ...box, ct: box.ct.slice(0, -4) + (box.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
    await expect(decryptJSON(key, bad)).rejects.toBeTruthy();
  });
});

describe('captured notifications', () => {
  it('seals with the public key and opens only with the private key', async () => {
    const keys = await newCaptureKeys();
    const box = await sealCapture(keys.publicKey, 'You have paid PHP 150.00 to MERALCO');
    expect(box.ct).not.toContain('MERALCO');
    expect(await openCapture(keys.privateKey, box)).toBe('You have paid PHP 150.00 to MERALCO');
    const other = await newCaptureKeys();
    await expect(openCapture(other.privateKey, box)).rejects.toBeTruthy();
  });
});
