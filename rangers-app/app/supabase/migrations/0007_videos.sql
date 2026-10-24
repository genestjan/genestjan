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
