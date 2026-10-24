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
-- Club admins: invite another admin with a one-time link, hand the club over, step down, and remove coaches who leave.
-- Safe to run more than once, on a new project or one already set up.

-- 1. Invites can now be for an admin.
alter table public.invites drop constraint if exists invites_kind_check;
alter table public.invites add constraint invites_kind_check check (kind in ('family','coach','admin'));

-- 2. An admin makes a one-time admin link. It gives full access, so it expires after 3 days (coach and family links: 14).
create or replace function public.create_admin_invite() returns text language plpgsql security definer set search_path = '' as $$
declare t text := public.new_token();
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  insert into public.invites (kind, token_hash, created_by, expires_at)
    values ('admin', public.token_hash(t), auth.uid(), now() + interval '3 days');
  return t;
end $$;

-- 3. Using an invite. Same as before, plus: an admin link makes the person an active admin straight away,
--    whatever they were before (a parent keeps their own children; a coach keeps their teams).
create or replace function public.redeem_invite(t text) returns text language plpgsql security definer set search_path = '' as $$
declare inv public.invites; nm text;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if (select count(*) from public.invite_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'too many tries, wait an hour'; end if;
  insert into public.invite_attempts (user_id) values (auth.uid());
  select * into inv from public.invites where token_hash = public.token_hash(t) for update;
  -- Return null (not an error) so the attempt above is kept and the rate limit really counts failures.
  if not found or inv.used_at is not null or inv.expires_at < now() then return null; end if;
  perform public.ensure_profile();
  if inv.kind = 'family' then
    insert into public.memberships (user_id, role, status) values (auth.uid(), 'parent', 'active')
      on conflict (user_id) do nothing;
    insert into public.player_guardians (player_id, user_id) values (inv.player_id, auth.uid()) on conflict do nothing;
    select first_name into nm from public.players where id = inv.player_id;
  elsif inv.kind = 'admin' then
    insert into public.memberships (user_id, role, status) values (auth.uid(), 'admin', 'active')
      on conflict (user_id) do update set role = 'admin', status = 'active';
    nm := 'admin';
  else
    -- A parent who is also becoming a coach is upgraded (pending admin approval); coaches and admins keep their role.
    insert into public.memberships (user_id, role, status) values (auth.uid(), 'coach', 'pending')
      on conflict (user_id) do update set role = 'coach', status = 'pending' where public.memberships.role = 'parent';
    nm := 'coach';
  end if;
  update public.invites set used_at = now(), used_by = auth.uid() where id = inv.id;
  return nm;
end $$;

-- 4. Take admin rights away (or step down yourself). The person stays as a coach. The club always keeps one admin.
create or replace function public.remove_admin(u uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  perform pg_advisory_xact_lock(4242);  -- two admins removing each other at once cannot leave the club with none
  if not exists (select 1 from public.memberships where user_id = u and role = 'admin') then raise exception 'not an admin'; end if;
  if not exists (select 1 from public.memberships where role = 'admin' and status = 'active' and user_id <> u) then
    raise exception 'the club needs at least one admin: invite the new admin first'; end if;
  update public.memberships set role = 'coach', status = 'active' where user_id = u;
end $$;

-- 5. A coach who leaves: off every team. If they are also a parent in the club they keep that (their own children only).
create or replace function public.remove_member(u uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if exists (select 1 from public.memberships where user_id = u and role = 'admin') then raise exception 'take away their admin rights first'; end if;
  delete from public.team_staff where user_id = u;
  if exists (select 1 from public.player_guardians where user_id = u) then
    update public.memberships set role = 'parent', status = 'active' where user_id = u;
  else
    delete from public.memberships where user_id = u;
  end if;
end $$;

-- 6. Take a coach off one team.
create or replace function public.remove_staff(u uuid, t uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  delete from public.team_staff where user_id = u and team_id = t;
end $$;

revoke execute on function public.create_admin_invite() from public, anon;
revoke execute on function public.remove_admin(uuid) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.remove_staff(uuid, uuid) from public, anon;
grant execute on function public.create_admin_invite(), public.remove_admin(uuid), public.remove_member(uuid), public.remove_staff(uuid, uuid) to authenticated;

-- 7. The checklist (from 0004) gains one line for this file.
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
  item := 'Admin invite links (0005)'; ok := to_regprocedure('public.create_admin_invite()') is not null; how_to_fix := 'Run 0005_admins.sql'; return next;
  item := 'Feedback box (0006)'; ok := to_regclass('public.feedback') is not null; how_to_fix := 'Run 0006_feedback.sql'; return next;
  item := 'Club admin set up'; ok := exists (select 1 from public.memberships where role = 'admin' and status = 'active'); how_to_fix := 'Sign in to the app and tap Set up the club (admin)'; return next;
end $$;
revoke execute on function public.rangers_health() from public, anon, authenticated;
-- Feedback about the app from anyone signed in (coaches, parents, players).
-- Read by club admins and by the people they choose ("feedback readers"), for example the person who started
-- the app and wants to keep hearing from families after handing the club over. Safe to run more than once.
-- Email: Supabase > Database > Webhooks can send each new row to an email script (see docs/feedback-email.md).

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null default '',          -- the sender's name at the time, so readers know who to thank
  role text not null default '',
  kind text not null check (kind in ('idea','problem','praise','other')),
  rating smallint check (rating between 1 and 3),   -- 1 not good, 2 okay, 3 great
  message text not null check (char_length(message) between 3 and 2000),
  page text not null default '' check (char_length(page) <= 100),
  status text not null default 'new' check (status in ('new','seen','done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created on public.feedback (created_at desc);
create table if not exists public.feedback_readers (
  user_id uuid primary key references auth.users on delete cascade,
  added_by uuid references auth.users on delete set null,
  added_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
alter table public.feedback_readers enable row level security;

create or replace function public.is_feedback_reader() returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (select 1 from public.feedback_readers r where r.user_id = auth.uid()) $$;

-- Senders see their own feedback; readers see all of it and may only change its status. Admins may delete.
drop policy if exists fb_read on public.feedback;
create policy fb_read on public.feedback for select to authenticated using (user_id = auth.uid() or public.is_feedback_reader());
drop policy if exists fb_status on public.feedback;
create policy fb_status on public.feedback for update to authenticated using (public.is_feedback_reader()) with check (public.is_feedback_reader());
drop policy if exists fb_delete on public.feedback;
create policy fb_delete on public.feedback for delete to authenticated using (public.is_admin());
drop policy if exists fbr_read on public.feedback_readers;
create policy fbr_read on public.feedback_readers for select to authenticated using (public.is_feedback_reader());
revoke all on public.feedback, public.feedback_readers from anon;
revoke insert, update on public.feedback from authenticated;
grant select, delete on public.feedback to authenticated;
grant update (status) on public.feedback to authenticated;   -- readers mark feedback seen or done, nothing else
revoke insert, update, delete on public.feedback_readers from authenticated;
grant select on public.feedback_readers to authenticated;

-- Sending: checks the words, notes who sent it, limits each person to 20 a day, and tells every reader.
create or replace function public.send_feedback(k text, msg text, stars int, where_in text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare fid uuid; nm text; msg_ text := btrim(coalesce(msg, ''));
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if char_length(msg_) < 3 then raise exception 'Please write a few words.'; end if;
  if (select count(*) from public.feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Thank you! That is a lot of feedback for one day. Please send more tomorrow.'; end if;
  perform public.ensure_profile();
  select display_name into nm from public.profiles where id = auth.uid();
  insert into public.feedback (user_id, name, role, kind, rating, message, page)
    values (auth.uid(), coalesce(nm, ''), coalesce(public.my_role(), 'signed in'), coalesce(k, 'other'), stars, left(msg_, 2000), left(coalesce(where_in, ''), 100))
    returning id into fid;
  insert into public.notification_queue (user_id, title, body, url, dedupe_key)
    select x.u, 'New feedback about the app', left(msg_, 120), '/feedback/inbox', 'fb:' || fid || ':' || x.u
    from (select m.user_id as u from public.memberships m where m.role = 'admin' and m.status = 'active'
          union select r.user_id from public.feedback_readers r) x
    where x.u <> auth.uid()
    on conflict do nothing;
  return fid;
end $$;

-- Admins choose who else reads feedback (and gets the alerts).
create or replace function public.set_feedback_reader(u uuid, keep boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if keep then insert into public.feedback_readers (user_id, added_by) values (u, auth.uid()) on conflict (user_id) do nothing;
  else delete from public.feedback_readers where user_id = u; end if;
end $$;

revoke execute on function public.is_feedback_reader() from public, anon;
revoke execute on function public.send_feedback(text, text, int, text) from public, anon;
revoke execute on function public.set_feedback_reader(uuid, boolean) from public, anon;
grant execute on function public.is_feedback_reader(), public.send_feedback(text, text, int, text), public.set_feedback_reader(uuid, boolean) to authenticated;

-- Clean-up job: feedback is kept for two years (same as before for everything else).
create or replace function public.purge_old_data() returns void language sql security definer set search_path = '' as $$
  delete from public.players where left_at < now() - interval '12 months';
  delete from public.notification_queue where coalesce(sent_at, send_at) < now() - interval '30 days';
  delete from public.invite_attempts where at < now() - interval '1 day';
  delete from public.feedback where created_at < now() - interval '24 months';
$$;
revoke execute on function public.purge_old_data() from public, anon, authenticated;

-- Tell the API about the new functions straight away (Supabase usually does this by itself).
notify pgrst, 'reload schema';

select * from public.rangers_health();
