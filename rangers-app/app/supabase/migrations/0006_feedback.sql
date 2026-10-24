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

select * from public.rangers_health();
