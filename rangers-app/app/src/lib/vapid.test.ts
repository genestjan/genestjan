// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createECDH, webcrypto } from 'node:crypto';
import { fromB64url, isVapidPublic, makeVapidKeys, pushCronSql } from './vapid';

describe('push alert keys', () => {
  it('makes a real P-256 key pair in the format web-push expects', async () => {
    const k = await makeVapidKeys(webcrypto.subtle as unknown as SubtleCrypto);
    expect(isVapidPublic(k.publicKey)).toBe(true); expect(fromB64url(k.privateKey).length).toBe(32);
    const e = createECDH('prime256v1'); e.setPrivateKey(Buffer.from(fromB64url(k.privateKey)));
    expect(Buffer.from(e.getPublicKey()).equals(Buffer.from(fromB64url(k.publicKey)))).toBe(true);   // the public key belongs to the private key
    expect(k.publicKey).not.toMatch(/[+/=]/);
  });
  it('the schedule SQL points at this project and runs every minute', () => {
    const sql = pushCronSql('https://abc.supabase.co/', 'anon123');
    expect(sql).toContain("'https://abc.supabase.co/functions/v1/send-push'"); expect(sql).toContain('Bearer anon123'); expect(sql).toContain("'* * * * *'");
    expect(isVapidPublic('nope')).toBe(false);
  });
});
