-- Rangers App database setup: paste into Supabase SQL Editor and Run, once, on a new project.
-- Rangers App core schema. One club, three programmes, coach and parent logins.
-- Row Level Security is on for every table; nothing is readable by anon.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- role: admin | coach | parent. status: pending coaches wait for admin approval.
create table public.memberships (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('admin','coach','parent')),
  status text not null default 'pending' check (status in ('pending','active')),
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key,
  name text not null,
  programme text not null check (programme in ('rangers','newmabu','gila')),
  age_band text not null check (age_band in ('U8','U10','U12','U14','U16')),
  default_format text not null default '8v8',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.team_staff (
  team_id uuid not null references public.teams on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  head boolean not null default false,
  primary key (team_id, user_id)
);

-- Kid-facing fields only. Emergency and health details live in player_private.
create table public.players (
  id uuid primary key,
  team_id uuid not null references public.teams,
  first_name text not null,
  last_name text,
  shirt_number int,
  birth_date date,
  gk_willing boolean not null default false,
  photo_consent boolean not null default false,
  left_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.player_private (
  player_id uuid primary key references public.players on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table public.player_guardians (
  player_id uuid not null references public.players on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  relation text not null default 'parent',
  primary key (player_id, user_id)
);
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players on delete cascade,
  user_id uuid not null references auth.users,
  kind text not null check (kind in ('data','photo','video','teamphoto')),
  granted boolean not null,
  notice_version text not null,
  at timestamptz not null default now()
);
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('family','coach')),
  token_hash text not null unique,
  player_id uuid references public.players on delete cascade,
  team_id uuid references public.teams on delete cascade,
  created_by uuid not null references auth.users,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users
);
create table public.invite_attempts (user_id uuid not null, at timestamptz not null default now());

-- Everything else (events, replies, announcements, messages, sessions, reviews, logs, fund...).
-- visibility: coach  = coaches of the team only
--             family = coaches of the team + guardians of player_id
--             team   = coaches + guardians of any player in the team
--             club   = every active member
--             staff  = every active coach and admin (saved moves, equipment)
create table public.records (
  id uuid primary key,
  kind text not null,
  team_id uuid references public.teams on delete cascade,
  player_id uuid references public.players on delete cascade,
  visibility text not null check (visibility in ('coach','family','team','club','staff')),
  data jsonb not null default '{}',
  author uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index records_team on public.records (team_id, updated_at);
create index records_player on public.records (player_id, updated_at);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users on delete cascade,
  p256dh text not null,
  auth text not null
);
create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null,
  url text not null default '/',
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  dedupe_key text unique
);
create table public.audit_log (
  id bigserial primary key,
  actor uuid default auth.uid(),
  tbl text not null, row_id text, action text not null,
  at timestamptz not null default now()
);

-- ---------- helpers (security definer, empty search_path) ----------
create function public.is_active_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active') $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active' and m.role = 'admin') $$;
create function public.is_coach_of(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.team_staff s join public.memberships m on m.user_id = s.user_id
    where s.team_id = t and s.user_id = auth.uid() and m.status = 'active' and m.role in ('coach','admin')) $$;
create function public.is_any_coach() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.status = 'active' and m.role in ('coach','admin')) $$;
create function public.is_guardian_of(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select p is not null and exists (select 1 from public.player_guardians g where g.player_id = p and g.user_id = auth.uid()) $$;
create function public.guardian_in_team(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select t is not null and exists (select 1 from public.player_guardians g join public.players p on p.id = g.player_id where p.team_id = t and g.user_id = auth.uid()) $$;
create function public.coach_of_player(p uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.players x where x.id = p and public.is_coach_of(x.team_id)) $$;
create function public.is_head_coach_of(t uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.team_staff s join public.memberships m on m.user_id = s.user_id
    where s.team_id = t and s.user_id = auth.uid() and s.head and m.status = 'active') $$;
create function public.touch() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create trigger t_records before update on public.records for each row execute function public.touch();

-- A suspected head injury blocks a child from lineups until a head coach or admin records clearance.
-- Clearing it, deleting it or un-marking it as a head injury is refused for everyone else.
create function public.guard_head_injury() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.kind = 'injury' and coalesce((old.data->>'head')::boolean, false) and old.data->>'clearedOn' is null and old.deleted_at is null
     and (new.data->>'clearedOn' is not null or new.deleted_at is not null or not coalesce((new.data->>'head')::boolean, false))
     and not public.is_head_coach_of(old.team_id) then
    raise exception 'only a head coach or the club admin can clear a head injury' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger t_head_injury before update on public.records for each row execute function public.guard_head_injury();

create function public.audit() returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  if tg_table_name <> 'records' or r->>'kind' in ('injury','assessment','charge','charge_ref','settings') then
    insert into public.audit_log (tbl, row_id, action) values (tg_table_name, coalesce(r->>'id', r->>'player_id', r->>'user_id'), tg_op);
  end if;
  return null;
end $$;
create trigger t_audit_records after insert or update or delete on public.records for each row execute function public.audit();
create trigger t_audit_private after insert or update or delete on public.player_private for each row execute function public.audit();
create trigger t_audit_members after insert or update or delete on public.memberships for each row execute function public.audit();
create trigger t_players before update on public.players for each row execute function public.touch();
create trigger t_teams before update on public.teams for each row execute function public.touch();
create trigger t_priv before update on public.player_private for each row execute function public.touch();

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.teams enable row level security;
alter table public.team_staff enable row level security;
alter table public.players enable row level security;
alter table public.player_private enable row level security;
alter table public.player_guardians enable row level security;
alter table public.consents enable row level security;
alter table public.invites enable row level security;
alter table public.invite_attempts enable row level security;
alter table public.records enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_queue enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or exists (
    select 1 from public.player_guardians g join public.players p on p.id = g.player_id where g.user_id = profiles.id and public.is_coach_of(p.team_id)));
create policy profiles_write on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_upd on public.profiles for update to authenticated using (id = auth.uid());

create policy mem_read on public.memberships for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- no direct writes: memberships change only through the RPCs below

create policy teams_read on public.teams for select to authenticated
  using (public.is_admin() or public.is_coach_of(id) or public.guardian_in_team(id));
create policy teams_write on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy staff_read on public.team_staff for select to authenticated using (user_id = auth.uid() or public.is_admin() or public.is_coach_of(team_id));
create policy staff_write on public.team_staff for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy players_read on public.players for select to authenticated
  using (public.is_coach_of(team_id) or public.is_guardian_of(id));
create policy players_write on public.players for all to authenticated
  using (public.is_coach_of(team_id)) with check (public.is_coach_of(team_id));

create policy priv_read on public.player_private for select to authenticated using (public.coach_of_player(player_id) or public.is_guardian_of(player_id));
create policy priv_write on public.player_private for all to authenticated
  using (public.coach_of_player(player_id) or public.is_guardian_of(player_id)) with check (public.coach_of_player(player_id) or public.is_guardian_of(player_id));

create policy guard_read on public.player_guardians for select to authenticated using (user_id = auth.uid() or public.coach_of_player(player_id));
create policy guard_del on public.player_guardians for delete to authenticated using (public.coach_of_player(player_id) and public.is_admin());

create policy consents_read on public.consents for select to authenticated using (user_id = auth.uid() or public.coach_of_player(player_id));
create policy consents_ins on public.consents for insert to authenticated with check (user_id = auth.uid() and public.is_guardian_of(player_id));

create policy inv_read on public.invites for select to authenticated using (created_by = auth.uid() or public.is_admin());

create policy rec_read on public.records for select to authenticated using (
  case visibility
    when 'club'   then public.is_active_member()
    when 'team'   then public.is_coach_of(team_id) or public.guardian_in_team(team_id)
    when 'family' then public.is_coach_of(team_id) or public.is_guardian_of(player_id)
    when 'staff'  then public.is_any_coach()
    else public.is_coach_of(team_id)
  end);
-- Coaches write within their teams; club-wide and staff rows by any coach; club settings (GCash number etc.) by admins only.
create policy rec_coach_write on public.records for insert to authenticated with check (
  author = auth.uid()
  and (kind <> 'settings' or public.is_admin())
  and case when visibility in ('club','staff') then public.is_any_coach() else public.is_coach_of(team_id) end);
create policy rec_coach_upd on public.records for update to authenticated using (
  (kind <> 'settings' or public.is_admin())
  and case when visibility in ('club','staff') then public.is_any_coach() else public.is_coach_of(team_id) end)
  with check ((kind <> 'settings' or public.is_admin())
  and case when visibility in ('club','staff') then public.is_any_coach() else public.is_coach_of(team_id) end);
-- Parents may only add and edit their own replies, messages and payment references for their own child.
create policy rec_parent_ins on public.records for insert to authenticated with check (
  visibility = 'family' and kind in ('availability','message','charge_ref','seen') and public.is_guardian_of(player_id)
  and author = auth.uid()
  and (kind <> 'message' or coalesce(data->>'from', '') = 'parent')
  and team_id = (select pl.team_id from public.players pl where pl.id = player_id));
create policy rec_parent_upd on public.records for update to authenticated using (
  visibility = 'family' and kind in ('availability','charge_ref') and public.is_guardian_of(player_id) and author = auth.uid())
  with check (visibility = 'family' and kind in ('availability','charge_ref') and public.is_guardian_of(player_id) and author = auth.uid()
  and team_id = (select pl.team_id from public.players pl where pl.id = player_id));

create policy push_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());

-- ---------- RPCs ----------
create function public.token_hash(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(t,'utf8')),'hex') $$;

-- The first person to call this when no admin exists becomes the club admin.
-- Name shown to the admin when approving coaches (from Google, else the email address).
create function public.ensure_profile() returns void language sql security definer set search_path = '' as $$
  insert into public.profiles (id, display_name)
  select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.email, '') from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing $$;

create function public.claim_admin() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  perform pg_advisory_xact_lock(4242);  -- two people tapping at once cannot both become admin
  if exists (select 1 from public.memberships where role = 'admin') then raise exception 'an admin already exists'; end if;
  perform public.ensure_profile();
  insert into public.memberships (user_id, role, status) values (auth.uid(), 'admin', 'active')
    on conflict (user_id) do update set role = 'admin', status = 'active';
end $$;

create function public.approve_member(u uuid, approve boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if approve then update public.memberships set status = 'active' where user_id = u;
  else delete from public.memberships where user_id = u and role <> 'admin'; end if;
end $$;

create function public.assign_staff(u uuid, t uuid, is_head boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  insert into public.team_staff (team_id, user_id, head) values (t, u, is_head) on conflict (team_id, user_id) do update set head = excluded.head;
end $$;

create function public.new_token() returns text language sql volatile as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;

create function public.create_family_invite(p uuid) returns text language plpgsql security definer set search_path = '' as $$
declare t text := public.new_token();
begin
  if not public.coach_of_player(p) then raise exception 'not allowed'; end if;
  insert into public.invites (kind, token_hash, player_id, created_by, expires_at)
    values ('family', public.token_hash(t), p, auth.uid(), now() + interval '14 days');
  return t;
end $$;

create function public.create_coach_invite() returns text language plpgsql security definer set search_path = '' as $$
declare t text := public.new_token();
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  insert into public.invites (kind, token_hash, created_by, expires_at)
    values ('coach', public.token_hash(t), auth.uid(), now() + interval '14 days');
  return t;
end $$;

-- Single-use, expiring, rate limited (10 tries per user per hour). Returns the child's first name.
create function public.redeem_invite(t text) returns text language plpgsql security definer set search_path = '' as $$
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
  else
    -- A parent who is also becoming a coach is upgraded (pending admin approval); coaches and admins keep their role.
    insert into public.memberships (user_id, role, status) values (auth.uid(), 'coach', 'pending')
      on conflict (user_id) do update set role = 'coach', status = 'pending' where public.memberships.role = 'parent';
    nm := 'coach';
  end if;
  update public.invites set used_at = now(), used_by = auth.uid() where id = inv.id;
  return nm;
end $$;

create function public.my_role() returns text language sql stable security definer set search_path = '' as $$
  select case when m.status = 'active' then m.role else 'pending' end from public.memberships m where m.user_id = auth.uid() $$;

create function public.ping() returns int language sql stable as $$ select 1 $$;

-- Parents record consent for their own child. Photo consent also updates the flag coaches see.
create function public.set_consent(p uuid, k text, granted boolean, version text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_guardian_of(p) then raise exception 'not your child' using errcode = '42501'; end if;
  insert into public.consents (player_id, user_id, kind, granted, notice_version) values (p, auth.uid(), k, granted, version);
  if k = 'photo' then update public.players set photo_consent = granted where id = p; end if;
end $$;

-- Retention: children who left more than a year ago (and everything about them) and old notifications.
create function public.purge_old_data() returns void language sql security definer set search_path = '' as $$
  delete from public.players where left_at < now() - interval '12 months';
  delete from public.notification_queue where coalesce(sent_at, send_at) < now() - interval '30 days';
  delete from public.invite_attempts where at < now() - interval '1 day';
$$;

-- Parent self-service: remove my own link to a child and download-able data come via normal reads.
create function public.leave_child(p uuid) returns void language sql security definer set search_path = '' as $$
  delete from public.player_guardians where player_id = p and user_id = auth.uid() $$;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.purge_old_data() from authenticated;
grant execute on function public.ping() to anon;   -- weekly keep-alive uses the public key
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
    -- Decide by who actually wrote it, never by what the message says about itself.
    if exists (select 1 from public.team_staff st where st.team_id = new.team_id and st.user_id = new.author)
       or exists (select 1 from public.memberships m where m.user_id = new.author and m.role = 'admin') then
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
      and data->>'startsAt' ~ '^\d{4}-\d{2}-\d{2}[T ]'
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
    perform cron.schedule('rangers-retention', '30 19 * * *', 'select public.purge_old_data()');
  end if;
end $$;
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
-- Short videos (up to 30 seconds, shrunk on the phone): children's proofs for tasks and coaches' how-to clips.
-- A separate private bucket with a cap for the whole club, so the free 1 GB never fills: when the cap is reached, new
-- videos are refused (nothing is ever deleted to make room). Longer videos go on YouTube (the video library).
-- Coaches' videos never expire; children's proof videos are deleted by the app 14 days after a coach checks them.
-- Same folders and the same people as photos: p/<child>/ (that child's family and coaches), t/<team>/ (the team).
-- Safe to run more than once.

-- The cap: 600 MB for videos, leaving the rest of the free 1 GB for photos.
create or replace function public.clips_used() returns bigint language plpgsql stable security definer set search_path = '' as $$
declare n bigint := 0;
begin
  if to_regclass('storage.objects') is not null then
    execute 'select coalesce(sum((metadata->>''size'')::bigint), 0) from storage.objects where bucket_id = ''clips''' into n;
  end if;
  return n;
end $$;
create or replace function public.clips_room() returns bigint language sql stable security definer set search_path = '' as $$
  select greatest(0, 600 * 1024 * 1024 - public.clips_used()) $$;
revoke execute on function public.clips_used() from public, anon;
revoke execute on function public.clips_room() from public, anon;
grant execute on function public.clips_used(), public.clips_room() to authenticated;

do $$ begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('clips', 'clips', false, 5242880, array['video/mp4','video/webm','video/quicktime'])
      on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;
    drop policy if exists clips_read on storage.objects;
    drop policy if exists clips_write on storage.objects;
    drop policy if exists clips_update on storage.objects;
    drop policy if exists clips_delete on storage.objects;
    create policy clips_read on storage.objects for select to authenticated using (bucket_id = 'clips' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_coach_of(split_part(name, '/', 2)::uuid) or public.guardian_in_team(split_part(name, '/', 2)::uuid)))));
    -- new videos only while there is room in the club's video space
    create policy clips_write on storage.objects for insert to authenticated with check (bucket_id = 'clips' and public.clips_room() > 0 and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))));
    create policy clips_update on storage.objects for update to authenticated using (bucket_id = 'clips' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))));
    -- a family may delete their own child's video (re-sending, or simply changing their mind); coaches their team's
    create policy clips_delete on storage.objects for delete to authenticated using (bucket_id = 'clips' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))));
  end if;
exception when others then
  insert into public.setup_log (note) values ('Storage: ' || sqlerrm);
end $$;

-- Who may be filmed for how-to videos: the family's answer to "Coaches may use video of ..." on the child's record,
-- so coaches can see it (like photo permission). Copied once from the answers families already gave.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'video_consent') then
    alter table public.players add column video_consent boolean not null default false;
    update public.players p set video_consent = c.granted
      from (select distinct on (player_id) player_id, granted from public.consents where kind = 'video' order by player_id, at desc) c where c.player_id = p.id;
  end if;
end $$;
create or replace function public.set_consent(p uuid, k text, granted boolean, version text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_guardian_of(p) then raise exception 'not your child' using errcode = '42501'; end if;
  insert into public.consents (player_id, user_id, kind, granted, notice_version) values (p, auth.uid(), k, granted, version);
  if k = 'photo' then update public.players set photo_consent = granted where id = p; end if;
  if k = 'video' then update public.players set video_consent = granted where id = p; end if;
end $$;

-- The checklist gains one line for this file.
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
  v := false; if to_regclass('storage.buckets') is not null then execute 'select exists (select 1 from storage.buckets where id = ''clips'' and not public and file_size_limit <= 5242880)' into v; end if;
  item := 'Private video storage (0007)'; ok := v and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'video_consent'); how_to_fix := 'Run 0007_videos.sql'; return next;
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

notify pgrst, 'reload schema';
select * from public.rangers_health();
-- Coaches' own drills (photos and short videos in a coaches-only folder), coaches' videos in the club's Google Drive,
-- and a test push alert. Safe to run more than once.

-- 1. The club's Google Drive. A small Google Apps Script, run by the club's Google account, stores coaches' videos
--    in that account's Drive. Before it stores or removes a file it asks this function, with the person's own sign-in.
--    Upload: any active coach. Remove: an admin, the coach who saved it in the app, or anyone while no record uses it
--    (a video uploaded and never saved). Drive file ids are long and random; anything else is refused.
create or replace function public.drive_ok(action text, file_id text default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select case action
    when 'upload' then public.is_any_coach()
    when 'delete' then public.is_any_coach() and coalesce(file_id, '') ~ '^[A-Za-z0-9_-]{20,}$' and (
      public.is_admin()
      or exists (select 1 from public.records r where r.deleted_at is null and r.author = auth.uid() and strpos(r.data::text, file_id) > 0)
      or not exists (select 1 from public.records r where r.deleted_at is null and strpos(r.data::text, file_id) > 0))
    else false end $$;
revoke execute on function public.drive_ok(text, text) from public, anon;
grant execute on function public.drive_ok(text, text) to authenticated;

-- 2. Photos and short videos of coaches' drills: folder d/<drill>/, for coaches only (any coach in the club).
do $$ begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists media_read on storage.objects;
    drop policy if exists media_write on storage.objects;
    drop policy if exists media_update on storage.objects;
    drop policy if exists media_delete on storage.objects;
    create policy media_read on storage.objects for select to authenticated using (bucket_id = 'media' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_coach_of(split_part(name, '/', 2)::uuid) or public.guardian_in_team(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 'd' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_any_coach())));
    create policy media_write on storage.objects for insert to authenticated with check (bucket_id = 'media' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))
      or (split_part(name, '/', 1) = 'd' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_any_coach())));
    create policy media_update on storage.objects for update to authenticated using (bucket_id = 'media' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))
      or (split_part(name, '/', 1) = 'd' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_any_coach())));
    create policy media_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.coach_of_player(split_part(name, '/', 2)::uuid))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))
      or (split_part(name, '/', 1) = 'd' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_any_coach())));

    drop policy if exists clips_read on storage.objects;
    drop policy if exists clips_write on storage.objects;
    drop policy if exists clips_update on storage.objects;
    drop policy if exists clips_delete on storage.objects;
    create policy clips_read on storage.objects for select to authenticated using (bucket_id = 'clips' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_coach_of(split_part(name, '/', 2)::uuid) or public.guardian_in_team(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 'd' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_any_coach())));
    create policy clips_write on storage.objects for insert to authenticated with check (bucket_id = 'clips' and public.clips_room() > 0 and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))
      or (split_part(name, '/', 1) = 'd' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_any_coach())));
    create policy clips_update on storage.objects for update to authenticated using (bucket_id = 'clips' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))
      or (split_part(name, '/', 1) = 'd' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_any_coach())));
    create policy clips_delete on storage.objects for delete to authenticated using (bucket_id = 'clips' and (
      (split_part(name, '/', 1) = 'p' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and (public.is_guardian_of(split_part(name, '/', 2)::uuid) or public.coach_of_player(split_part(name, '/', 2)::uuid)))
      or (split_part(name, '/', 1) = 't' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_coach_of(split_part(name, '/', 2)::uuid))
      or (split_part(name, '/', 1) = 'd' and split_part(name, '/', 2) ~ '^[0-9a-f-]{36}$' and public.is_any_coach())));
  end if;
exception when others then
  insert into public.setup_log (note) values ('Storage: ' || sqlerrm);
end $$;

-- 3. "Send me a test alert" in the app: one alert to yourself, sent within a minute once push alerts are set up.
create or replace function public.queue_test_alert() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if (select count(*) from public.notification_queue where user_id = auth.uid() and dedupe_key like 'test:%' and send_at > now() - interval '1 hour') >= 5 then
    raise exception 'too many test alerts, wait an hour'; end if;
  insert into public.notification_queue (user_id, title, body, url, dedupe_key)
    values (auth.uid(), 'Rangers FC', 'Test alert: alerts work on this phone. We move as one!', '/', 'test:' || auth.uid() || ':' || gen_random_uuid());
end $$;
revoke execute on function public.queue_test_alert() from public, anon;
grant execute on function public.queue_test_alert() to authenticated;

-- 4. The checklist gains two lines for this file (push alerts are optional, so that line may say false).
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
  v := false; if to_regclass('storage.buckets') is not null then execute 'select exists (select 1 from storage.buckets where id = ''clips'' and not public and file_size_limit <= 5242880)' into v; end if;
  item := 'Private video storage (0007)'; ok := v and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'video_consent'); how_to_fix := 'Run 0007_videos.sql'; return next;
  item := 'Coaches'' drills and Google Drive videos (0008)'; ok := to_regprocedure('public.drive_ok(text,text)') is not null and exists (select 1 from pg_policies where policyname = 'media_read' and qual like '%''d''%'); how_to_fix := 'Run 0008_drills_drive_alerts.sql'; return next;
  item := 'pg_cron switched on'; ok := exists (select 1 from pg_extension where extname = 'pg_cron'); how_to_fix := 'Database > Extensions > pg_cron, then run this file again'; return next;
  v := false; if to_regclass('cron.job') is not null then execute 'select count(*) = 2 from cron.job where jobname in (''rangers-reminders'', ''rangers-retention'')' into v; end if;
  item := 'Reminder and clean-up jobs scheduled'; ok := v; how_to_fix := 'Turn on pg_cron, then run this file again'; return next;
  v := false; if to_regclass('cron.job') is not null then execute 'select exists (select 1 from cron.job where jobname = ''rangers-send-push'')' into v; end if;
  item := 'Push alerts sending (optional)'; ok := v; how_to_fix := 'In the app: Settings, Push alerts, and follow the steps'; return next;
  item := 'Live messages (Realtime)'; ok := exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'); how_to_fix := 'Run 0002_notifications.sql (only on Supabase)'; return next;
  item := 'Either parent can re-send a proof (0004)'; ok := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'records' and policyname = 'rec_parent_upd_v2'); how_to_fix := 'Run 0004_fixups.sql'; return next;
  item := 'Internal functions closed to the public'; ok := not has_function_privilege('anon', 'public.team_guardians(uuid)', 'execute'); how_to_fix := 'Run 0004_fixups.sql'; return next;
  item := 'Admin invite links (0005)'; ok := to_regprocedure('public.create_admin_invite()') is not null; how_to_fix := 'Run 0005_admins.sql'; return next;
  item := 'Feedback box (0006)'; ok := to_regclass('public.feedback') is not null; how_to_fix := 'Run 0006_feedback.sql'; return next;
  item := 'Club admin set up'; ok := exists (select 1 from public.memberships where role = 'admin' and status = 'active'); how_to_fix := 'Sign in to the app and tap Set up the club (admin)'; return next;
end $$;
revoke execute on function public.rangers_health() from public, anon, authenticated;

notify pgrst, 'reload schema';
select * from public.rangers_health();
-- Every age group (U6 to U19, 20+, 30+, 40+), and teams that mix age groups. Safe to run more than once.
-- age_band stays the youngest age group (plans and safety rules follow it); age_bands lists them all when a team mixes them.
alter table public.teams drop constraint if exists teams_age_band_check;
alter table public.teams add constraint teams_age_band_check check (age_band in ('U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','20+','30+','40+'));
alter table public.teams add column if not exists age_bands text[] not null default '{}';
alter table public.teams drop constraint if exists teams_age_bands_check;
alter table public.teams add constraint teams_age_bands_check check (age_bands <@ array['U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','20+','30+','40+']::text[] and cardinality(age_bands) <= 17);

-- The checklist gains one line for this file.
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
  v := false; if to_regclass('storage.buckets') is not null then execute 'select exists (select 1 from storage.buckets where id = ''clips'' and not public and file_size_limit <= 5242880)' into v; end if;
  item := 'Private video storage (0007)'; ok := v and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'video_consent'); how_to_fix := 'Run 0007_videos.sql'; return next;
  item := 'Coaches'' drills and Google Drive videos (0008)'; ok := to_regprocedure('public.drive_ok(text,text)') is not null and exists (select 1 from pg_policies where policyname = 'media_read' and qual like '%''d''%'); how_to_fix := 'Run 0008_drills_drive_alerts.sql'; return next;
  item := 'pg_cron switched on'; ok := exists (select 1 from pg_extension where extname = 'pg_cron'); how_to_fix := 'Database > Extensions > pg_cron, then run this file again'; return next;
  v := false; if to_regclass('cron.job') is not null then execute 'select count(*) = 2 from cron.job where jobname in (''rangers-reminders'', ''rangers-retention'')' into v; end if;
  item := 'Reminder and clean-up jobs scheduled'; ok := v; how_to_fix := 'Turn on pg_cron, then run this file again'; return next;
  v := false; if to_regclass('cron.job') is not null then execute 'select exists (select 1 from cron.job where jobname = ''rangers-send-push'')' into v; end if;
  item := 'Push alerts sending (optional)'; ok := v; how_to_fix := 'In the app: Settings, Push alerts, and follow the steps'; return next;
  item := 'Live messages (Realtime)'; ok := exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'); how_to_fix := 'Run 0002_notifications.sql (only on Supabase)'; return next;
  item := 'Either parent can re-send a proof (0004)'; ok := exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'records' and policyname = 'rec_parent_upd_v2'); how_to_fix := 'Run 0004_fixups.sql'; return next;
  item := 'Internal functions closed to the public'; ok := not has_function_privilege('anon', 'public.team_guardians(uuid)', 'execute'); how_to_fix := 'Run 0004_fixups.sql'; return next;
  item := 'Admin invite links (0005)'; ok := to_regprocedure('public.create_admin_invite()') is not null; how_to_fix := 'Run 0005_admins.sql'; return next;
  item := 'Feedback box (0006)'; ok := to_regclass('public.feedback') is not null; how_to_fix := 'Run 0006_feedback.sql'; return next;
  item := 'All age groups and mixed teams (0009)'; ok := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'teams' and column_name = 'age_bands'); how_to_fix := 'Run 0009_age_groups.sql'; return next;
  item := 'Club admin set up'; ok := exists (select 1 from public.memberships where role = 'admin' and status = 'active'); how_to_fix := 'Sign in to the app and tap Set up the club (admin)'; return next;
end $$;
revoke execute on function public.rangers_health() from public, anon, authenticated;

notify pgrst, 'reload schema';
select * from public.rangers_health();
