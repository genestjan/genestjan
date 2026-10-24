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
  v := false; if to_regclass('storage.buckets') is not null then execute 'select exists (select 1 from storage.buckets where id = ''media'' and not public)' into v; end if;
  item := 'Private photo and video storage'; ok := v; how_to_fix := 'Run 0003_assignments.sql'; return next;
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
