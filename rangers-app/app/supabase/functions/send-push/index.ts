// Supabase Edge Function (Deno). Sends due rows from notification_queue as Web Push messages.
// Scheduled every minute with pg_cron + pg_net (the app's Settings, Push alerts, gives the SQL).
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. Tested on Deno 2.1 against the local stack and a pretend push service
// (the alert decrypts, the VAPID signature verifies); not yet against a live Supabase project.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async () => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const { data: due } = await db.from('notification_queue').select('*').is('sent_at', null).lte('send_at', new Date().toISOString()).limit(200);
  let sent = 0, dead = 0;
  for (const n of due ?? []) {
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', n.user_id);
    for (const s of subs ?? []) {
      try {
        // high urgency: phones deliver it straight away, even when asleep; kept for a day if the phone is off
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.id }), { urgency: 'high', TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        console.error('push failed', code ?? '', String((e as Error).message ?? e).slice(0, 200));   // shows in Supabase, Edge Functions, Logs
        if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); dead++; }
      }
    }
    await db.from('notification_queue').update({ sent_at: new Date().toISOString() }).eq('id', n.id);
  }
  return new Response(JSON.stringify({ due: due?.length ?? 0, sent, dead }), { headers: { 'content-type': 'application/json' } });
});
