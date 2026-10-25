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
