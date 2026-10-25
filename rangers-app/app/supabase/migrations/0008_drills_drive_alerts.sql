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
