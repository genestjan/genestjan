-- Rangers App update: for a project set up with an older setup.sql. Paste into Supabase SQL Editor and Run. Safe to run again.
-- Assignments: coaches send tasks, families send back a photo as proof. (Photos only, to stay inside the free storage.)
-- Parents may add and re-send their own child's proofs, but never approve them.

create or replace function public.on_record_insert() returns trigger language plpgsql security definer set search_path = '' as $$
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
    -- Decide by who actually wrote it, never by what the message says about itself.
    if exists (select 1 from public.team_staff st where st.team_id = new.team_id and st.user_id = new.author)
       or exists (select 1 from public.memberships m where m.user_id = new.author and m.role = 'admin') then
      for u in select user_id from public.player_guardians where player_id = new.player_id loop
        insert into public.notification_queue (user_id, title, body, url, dedupe_key) values (u, 'Message from your coach', body, '/inbox', 'msg:' || new.id || ':' || u) on conflict do nothing; end loop;
    else
      for u in select public.team_coaches(new.team_id) loop
        insert into public.notification_queue (user_id, title, body, url, dedupe_key) values (u, ttl, body, '/inbox', 'msg:' || new.id || ':' || u) on conflict do nothing; end loop;
    end if;
  elsif new.kind = 'assignment' then
    for u in select user_id from public.player_guardians where player_id = new.player_id loop
      insert into public.notification_queue (user_id, title, body, url, dedupe_key)
        values (u, 'New assignment from your coach', left(coalesce(new.data->>'title', 'Tasks to do'), 120), '/tasks', 'as:' || new.id || ':' || u) on conflict do nothing;
    end loop;
  elsif new.kind = 'submission' then
    for u in select public.team_coaches(new.team_id) loop
      insert into public.notification_queue (user_id, title, body, url, dedupe_key)
        values (u, 'A task was sent in', 'Open Assign to review it', '/assign', 'sub:' || new.id || ':' || u) on conflict do nothing;
    end loop;
  end if;
  return new;
end $$;

drop policy if exists rec_parent_ins on public.records;
create policy rec_parent_ins on public.records for insert to authenticated with check (
  visibility = 'family' and kind in ('availability','message','charge_ref','seen','submission') and public.is_guardian_of(player_id)
  and author = auth.uid()
  and (kind <> 'message' or coalesce(data->>'from', '') = 'parent')
  and (kind <> 'submission' or (coalesce(data->>'status', '') = 'submitted' and coalesce(data->>'feedback', '') = ''))
  and team_id = (select pl.team_id from public.players pl where pl.id = player_id));
drop policy if exists rec_parent_upd on public.records;
create policy rec_parent_upd on public.records for update to authenticated using (
  visibility = 'family' and kind in ('availability','charge_ref','submission') and public.is_guardian_of(player_id) and author = auth.uid()
  and (kind <> 'submission' or coalesce(data->>'status', '') in ('submitted','redo')))
  with check (visibility = 'family' and kind in ('availability','charge_ref','submission') and public.is_guardian_of(player_id) and author = auth.uid()
  and (kind <> 'submission' or (coalesce(data->>'status', '') = 'submitted' and coalesce(data->>'feedback', '') = ''))
  and team_id = (select pl.team_id from public.players pl where pl.id = player_id));

-- Private storage bucket for photos, 2 MB each at most (only where Supabase Storage exists).
-- p/<child id>/<file>: a child's proofs, readable by that child's parents and coaches.
-- t/<team id>/<file>: a coach's how-to photos, readable by the team's coaches and parents.
-- Notes from setup steps that could not finish (shown by the health checklist in 0004). Not readable through the app.
create table if not exists public.setup_log (at timestamptz not null default now(), note text not null);
alter table public.setup_log enable row level security;
revoke all on public.setup_log from anon, authenticated;

do $$ begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('media', 'media', false, 2097152, array['image/jpeg','image/png','image/webp'])
      on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;
    drop policy if exists media_read on storage.objects;
    drop policy if exists media_write on storage.objects;
    drop policy if exists media_update on storage.objects;
    drop policy if exists media_delete on storage.objects;
    create policy media_read on storage.objects for select to authenticated using (bucket_id = 'media' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_coach_of(split_part(name, '/', 2)::uuid) or public.guardian_in_team(split_part(name, '/', 2)::uuid)))));
    create policy media_write on storage.objects for insert to authenticated with check (bucket_id = 'media' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))));
    create policy media_update on storage.objects for update to authenticated using (bucket_id = 'media' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))));
    create policy media_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.coach_of_player(split_part(name, '/', 2)::uuid))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))));
  end if;
exception when others then
  -- Keep the rest of this file: record why storage could not be set up, so the checklist can say so.
  insert into public.setup_log (note) values ('Storage: ' || sqlerrm);
end $$;
-- Fix-ups found in review. Safe to run more than once, on a new project or one already set up.

-- 1. Internal functions are for the database itself, not for the app or the public.
revoke execute on function public.team_guardians(uuid) from public, anon, authenticated;
revoke execute on function public.team_coaches(uuid) from public, anon, authenticated;
revoke execute on function public.enqueue_event_reminders() from public, anon, authenticated;
revoke execute on function public.on_record_insert() from public, anon, authenticated;
revoke execute on function public.purge_old_data() from public, anon, authenticated;

-- 2. Scheduled jobs. If pg_cron was switched on after setup.sql ran, the jobs were never created.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('rangers-reminders', 'rangers-retention');
    perform cron.schedule('rangers-reminders', '0 * * * *', 'select public.enqueue_event_reminders()');
    perform cron.schedule('rangers-retention', '30 19 * * *', 'select public.purge_old_data()');
  end if;
end $$;

-- 3. Either parent of a child may re-send a proof (not only the parent who sent it first). Approval stays with coaches.
-- Own name, so running 0003 again cannot undo it (permissive policies add up; 0003's rule is a subset of this one).
drop policy if exists rec_parent_upd on public.records;
drop policy if exists rec_parent_upd_v2 on public.records;
create policy rec_parent_upd_v2 on public.records for update to authenticated using (
  visibility = 'family' and public.is_guardian_of(player_id) and (
    (kind in ('availability','charge_ref') and author = auth.uid())
    or (kind = 'submission' and coalesce(data->>'status', '') in ('submitted','redo'))))
  with check (visibility = 'family' and public.is_guardian_of(player_id)
  and team_id = (select pl.team_id from public.players pl where pl.id = player_id) and (
    (kind in ('availability','charge_ref') and author = auth.uid())
    or (kind = 'submission' and coalesce(data->>'status', '') = 'submitted' and coalesce(data->>'feedback', '') = '')));

-- 4. Parents may replace their own child's proof file (re-sending overwrites the old file instead of leaving it behind).
--    (The update policy from 0003 already allows it; nothing to change here.)

-- 5. A checklist you can run any time in the SQL Editor: select * from public.rangers_health();
create or replace function public.rangers_health() returns table (item text, ok boolean, how_to_fix text)
language plpgsql security invoker set search_path = '' as $$
declare v boolean;
begin
  item := 'Core tables (setup.sql)'; ok := to_regclass('public.records') is not null; how_to_fix := 'Run setup.sql'; return next;
  item := 'Assignments rules (0003)'; ok := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'records' and policyname = 'rec_parent_ins' and with_check like '%submission%'); how_to_fix := 'Run 0003_assignments.sql'; return next;
  v := false; if to_regclass('storage.buckets') is not null then execute 'select exists (select 1 from storage.buckets where id = ''media'' and not public and file_size_limit <= 2097152)' into v; end if;
  item := 'Private photo storage'; ok := v;
  how_to_fix := 'Run 0003_assignments.sql';
  if not v and to_regclass('public.setup_log') is not null then
    execute 'select ''Failed: '' || note from public.setup_log where note like ''Storage:%'' order by at desc limit 1' into how_to_fix;
    how_to_fix := coalesce(how_to_fix, 'Run 0003_assignments.sql');
  end if;
  return next;
  item := 'pg_cron switched on'; ok := exists (select 1 from pg_extension where extname = 'pg_cron'); how_to_fix := 'Database > Extensions > pg_cron, then run this file again'; return next;
  v := false; if to_regclass('cron.job') is not null then execute 'select count(*) = 2 from cron.job where jobname in (''rangers-reminders'', ''rangers-retention'')' into v; end if;
  item := 'Reminder and clean-up jobs scheduled'; ok := v; how_to_fix := 'Turn on pg_cron, then run this file again'; return next;
  item := 'Live messages (Realtime)'; ok := exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'); how_to_fix := 'Run 0002_notifications.sql (only on Supabase)'; return next;
  item := 'Either parent can re-send a proof (0004)'; ok := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'records' and policyname = 'rec_parent_upd_v2'); how_to_fix := 'Run 0004_fixups.sql'; return next;
  item := 'Internal functions closed to the public'; ok := not has_function_privilege('anon', 'public.team_guardians(uuid)', 'execute'); how_to_fix := 'Run 0004_fixups.sql'; return next;
  item := 'Club admin set up'; ok := exists (select 1 from public.memberships where role = 'admin' and status = 'active'); how_to_fix := 'Sign in to the app and tap Set up the club (admin)'; return next;
end $$;
revoke execute on function public.rangers_health() from public, anon, authenticated;

select * from public.rangers_health();
