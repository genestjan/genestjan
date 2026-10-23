// Supabase Edge Function (Deno). Sends due rows from notification_queue as Web Push messages.
// Schedule it every 10 minutes (Dashboard > Edge Functions > Schedules, or pg_cron + pg_net).
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. NOT YET TESTED against a live project:
// verify `npm:web-push` runs on the Edge runtime during go-live and swap for a Deno web-push library if not.
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
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: n.title, body: n.body, url: n.url }));
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); dead++; }
      }
    }
    await db.from('notification_queue').update({ sent_at: new Date().toISOString() }).eq('id', n.id);
  }
  return new Response(JSON.stringify({ due: due?.length ?? 0, sent, dead }), { headers: { 'content-type': 'application/json' } });
});
