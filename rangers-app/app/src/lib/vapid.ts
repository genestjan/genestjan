/** Push alert keys, made on the admin's own phone or computer (WebCrypto). The public key goes into the club settings;
 *  the private key is shown once, to paste into Supabase, and is never saved or sent anywhere by the app. */
export const b64url = (b: Uint8Array) => { let s = ''; b.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
export const isVapidPublic = (k: string) => { try { const b = fromB64url(k.trim()); return b.length === 65 && b[0] === 4; } catch { return false; } };

export async function makeVapidKeys(subtle: SubtleCrypto = crypto.subtle): Promise<{ publicKey: string; privateKey: string }> {
  const k = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const j = await subtle.exportKey('jwk', k.privateKey);
  const pub = new Uint8Array(65); pub[0] = 4; pub.set(fromB64url(j.x!), 1); pub.set(fromB64url(j.y!), 33);
  return { publicKey: b64url(pub), privateKey: j.d! };
}

/** The SQL the admin runs once: send waiting alerts every minute (pg_cron calls the send-push function). */
export function pushCronSql(projectUrl: string, anonKey: string) {
  return `-- Rangers App: send push alerts every minute. Safe to run again.
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'rangers-send-push';
select cron.schedule('rangers-send-push', '* * * * *', $job$
  select net.http_post(url := '${projectUrl.replace(/\/$/, '')}/functions/v1/send-push',
    headers := '{"Authorization": "Bearer ${anonKey}", "Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $job$);
select * from public.rangers_health();`;
}
