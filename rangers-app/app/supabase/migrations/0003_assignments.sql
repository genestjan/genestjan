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
