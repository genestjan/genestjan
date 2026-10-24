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
