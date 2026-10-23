// @vitest-environment node
import { deriveKek, fromB64, newDataKey, newDeviceKey, open, passwordProblem, seal, toB64, unwrapDataKey, wrapDataKey, randomBytes } from './vault';

const salt = () => toB64(randomBytes(16));
const ITER = 1000; // fast for tests; the app uses 250,000

describe('vault', () => {
  it('round-trips data with a password-wrapped key', async () => {
    const s = salt();
    const dk = await newDataKey();
    const wrapped = await wrapDataKey(dk, await deriveKek('correct horse', s, ITER));
    const sealed = await seal(dk, JSON.stringify({ plan: 'GenSan to Davao', phone: '0917' }));
    expect(sealed.data).not.toContain('Davao');

    const again = await unwrapDataKey(wrapped, await deriveKek('correct horse', s, ITER));
    expect(JSON.parse(await open(again, sealed))).toEqual({ plan: 'GenSan to Davao', phone: '0917' });
  });

  it('rejects a wrong password', async () => {
    const s = salt();
    const dk = await newDataKey();
    const wrapped = await wrapDataKey(dk, await deriveKek('right-password', s, ITER));
    await expect(unwrapDataKey(wrapped, await deriveKek('wrong-password', s, ITER))).rejects.toBeDefined();
  });

  it('changing the password re-wraps the same data key', async () => {
    const s = salt();
    const dk = await newDataKey();
    const sealed = await seal(dk, 'my plans');
    const w1 = await wrapDataKey(dk, await deriveKek('old-password', s, ITER));
    const opened = await unwrapDataKey(w1, await deriveKek('old-password', s, ITER));
    const s2 = salt();
    const w2 = await wrapDataKey(opened, await deriveKek('new-password', s2, ITER));
    const viaNew = await unwrapDataKey(w2, await deriveKek('new-password', s2, ITER));
    expect(await open(viaNew, sealed)).toBe('my plans');
  });

  it('refuses tampered ciphertext', async () => {
    const dk = await newDataKey();
    const sealed = await seal(dk, 'hello');
    const bytes = fromB64(sealed.data);
    bytes[0] ^= 1;
    await expect(open(dk, { ...sealed, data: toB64(bytes) })).rejects.toBeDefined();
  });

  it('a device key wraps the data key but cannot be exported', async () => {
    const dk = await newDataKey();
    const device = await newDeviceKey();
    expect(device.extractable).toBe(false);
    const wrapped = await wrapDataKey(dk, device);
    const back = await unwrapDataKey(wrapped, device);
    expect(await open(back, await seal(dk, 'x'))).toBe('x');
  });

  it('gives friendly password feedback', () => {
    expect(passwordProblem('short')).toMatch(/at least 8/);
    expect(passwordProblem('aaaaaaaa')).toMatch(/mixing/);
    expect(passwordProblem('password')).toMatch(/common/);
    expect(passwordProblem('bicycle-4-life')).toBeNull();
  });
});
