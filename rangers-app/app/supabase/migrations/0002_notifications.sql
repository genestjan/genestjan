-- Reminders and alerts. Rows land in notification_queue; the send-push Edge Function delivers them.

-- Who should hear about something in a team: guardians of its players.
create function public.team_guardians(t uuid) returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct g.user_id from public.player_guardians g join public.players p on p.id = g.player_id where p.team_id = t and p.deleted_at is null $$;
create function public.team_coaches(t uuid) returns setof uuid language sql stable security definer set search_path = '' as $$
  select s.user_id from public.team_staff s join public.memberships m on m.user_id = s.user_id where s.team_id = t and m.status = 'active' $$;

-- New announcement or message -> notify the right people (not the author).
create function public.on_record_insert() returns trigger language plpgsql security definer set search_path = '' as $$
declare u uuid; ttl text; body text;
begin
  if new.kind = 'announcement' then
    ttl := coalesce(new.data->>'title', 'Club news'); body := left(coalesce(new.data->>'body', ''), 120);
    for u in select user_id from public.memberships where status = 'active' and role = 'parent' and (new.team_id is null or user_id in (select public.team_guardians(new.team_id))) loop
      if u <> coalesce(new.author, '00000000-0000-0000-0000-000000000000') then
        insert into public.notification_queue (user_id, title, body, url, dedupe_key) values (u, ttl, body, '/inbox', 'an:' || new.id || ':' || u) on conflict do nothing; end if;
    end loop;
  elsif new.kind = 'message' then
    ttl := 'New message'; body := left(coalesce(new.data->>'body', ''), 120);
    if coalesce(new.data->>'from', '') = 'coach' then
      for u in select user_id from public.player_guardians where player_id = new.player_id loop
        insert into public.notification_queue (user_id, title, body, url, dedupe_key) values (u, 'Message from your coach', body, '/inbox', 'msg:' || new.id || ':' || u) on conflict do nothing; end loop;
    else
      for u in select public.team_coaches(new.team_id) loop
        insert into public.notification_queue (user_id, title, body, url, dedupe_key) values (u, ttl, body, '/inbox', 'msg:' || new.id || ':' || u) on conflict do nothing; end loop;
    end if;
  end if;
  return new;
end $$;
create trigger t_records_notify after insert on public.records for each row execute function public.on_record_insert();

-- Day-before reminders for events starting in 20 to 28 hours. Safe to run every hour.
create function public.enqueue_event_reminders() returns int language plpgsql security definer set search_path = '' as $$
declare r record; u uuid; n int := 0; c int;
begin
  for r in select id, team_id, data from public.records
    where kind = 'event' and deleted_at is null and coalesce((data->>'cancelled')::boolean, false) = false
      and (data->>'startsAt')::timestamptz between now() + interval '20 hours' and now() + interval '28 hours' loop
    for u in select public.team_guardians(r.team_id) loop
      insert into public.notification_queue (user_id, title, body, url, dedupe_key)
        values (u, 'Tomorrow: ' || coalesce(r.data->>'title', 'Event'), coalesce(r.data->>'venue', '') || ' - tap to say Going or Not going', '/schedule', 'ev:' || r.id || ':' || u)
        on conflict do nothing;
      get diagnostics c = row_count; n := n + c;
    end loop;
  end loop;
  return n;
end $$;

-- Live updates for messaging (guarded so plain Postgres can run this file).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;

-- Hourly reminders and 10-minute sends (only where pg_cron / pg_net exist, i.e. on Supabase).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('rangers-reminders', '0 * * * *', 'select public.enqueue_event_reminders()');
  end if;
end $$;
