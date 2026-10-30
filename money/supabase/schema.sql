-- Money Hub cloud. Run once: Supabase > SQL Editor > New query > paste all of this > Run.
-- Safe to run again after an update.
--
-- Everything stored here is ciphertext made on your own devices. The server cannot read amounts,
-- names or notes. Row Level Security lets a signed-in person reach only their own rows.

create sequence if not exists public.money_seq;

-- One row per encrypted record (transactions, accounts, budgets, bills, settings...).
create table if not exists public.money_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) <= 64),
  iv text not null check (char_length(iv) <= 32),
  ct text not null check (char_length(ct) <= 200000),
  seq bigint not null default nextval('public.money_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists money_records_seq on public.money_records (user_id, seq);

-- Every write takes the next number, so a device can ask "what changed since number N?".
create or replace function public.money_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.seq := nextval('public.money_seq');
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists money_touch on public.money_records;
create trigger money_touch before insert or update on public.money_records
  for each row execute function public.money_touch();

-- The data key, locked with your password and separately with your recovery key.
create table if not exists public.money_vault (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  boxes jsonb not null,
  rk_check text not null,
  updated_at timestamptz not null default now()
);

-- Notifications the phone captured while Money Hub was closed, sealed so only an unlocked app
-- can open them.
create table if not exists public.money_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists money_inbox_user on public.money_inbox (user_id, created_at);

-- Write-only tokens the phone uses to drop captures into the inbox. Only a hash is kept.
create table if not exists public.money_drop_tokens (
  token_hash text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  last_used timestamptz
);

-- If you later add an authenticator app (two-factor), these rules start requiring it.
create or replace function public.money_aal_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
      )
$$;

-- Signed-in people may use these tables (Row Level Security below narrows it to their own rows).
-- Visitors who are not signed in get nothing.
grant usage, select on sequence public.money_seq to authenticated;
grant select, insert, update, delete on public.money_records, public.money_vault, public.money_drop_tokens to authenticated;
grant select, delete on public.money_inbox to authenticated;
revoke all on public.money_records, public.money_vault, public.money_inbox, public.money_drop_tokens from anon;

alter table public.money_records enable row level security;
alter table public.money_vault enable row level security;
alter table public.money_inbox enable row level security;
alter table public.money_drop_tokens enable row level security;

drop policy if exists money_records_own on public.money_records;
create policy money_records_own on public.money_records for all to authenticated
  using (user_id = (select auth.uid()) and public.money_aal_ok())
  with check (user_id = (select auth.uid()) and public.money_aal_ok());

drop policy if exists money_vault_own on public.money_vault;
create policy money_vault_own on public.money_vault for all to authenticated
  using (user_id = (select auth.uid()) and public.money_aal_ok())
  with check (user_id = (select auth.uid()) and public.money_aal_ok());

drop policy if exists money_inbox_read on public.money_inbox;
create policy money_inbox_read on public.money_inbox for select to authenticated
  using (user_id = (select auth.uid()) and public.money_aal_ok());

drop policy if exists money_inbox_clear on public.money_inbox;
create policy money_inbox_clear on public.money_inbox for delete to authenticated
  using (user_id = (select auth.uid()) and public.money_aal_ok());

drop policy if exists money_tokens_own on public.money_drop_tokens;
create policy money_tokens_own on public.money_drop_tokens for all to authenticated
  using (user_id = (select auth.uid()) and public.money_aal_ok())
  with check (user_id = (select auth.uid()) and public.money_aal_ok());

-- The phone calls this with its token. It can add a sealed capture and nothing else.
create or replace function public.money_drop(p_token text, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
  h text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
begin
  select t.user_id into uid from public.money_drop_tokens t where t.token_hash = h;
  if uid is null then raise exception 'unknown token'; end if;
  if pg_column_size(p_payload) > 16000 then raise exception 'capture too large'; end if;
  if (select count(*) from public.money_inbox i where i.user_id = uid) >= 5000 then
    raise exception 'inbox full';
  end if;
  insert into public.money_inbox (user_id, payload) values (uid, p_payload);
  update public.money_drop_tokens set last_used = now() where token_hash = h;
end $$;
revoke all on function public.money_drop(text, jsonb) from public;
grant execute on function public.money_drop(text, jsonb) to anon, authenticated;

-- Forgotten password: the app proves you hold the recovery key (the server only has a hash of
-- the proof) and sets a new sign-in secret. Your data key is then re-locked on the device.
create or replace function public.money_recover(p_email text, p_proof text, p_new_password text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
  chk text;
begin
  if char_length(coalesce(p_new_password, '')) < 20 then raise exception 'recovery failed'; end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(p_email));
  select v.rk_check into chk from public.money_vault v where v.user_id = uid;
  if uid is null or chk is null or chk <> encode(sha256(convert_to(coalesce(p_proof, ''), 'UTF8')), 'hex') then
    perform pg_sleep(1);
    raise exception 'recovery failed';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')), updated_at = now()
   where id = uid;
end $$;
revoke all on function public.money_recover(text, text, text) from public;
grant execute on function public.money_recover(text, text, text) to anon, authenticated;

-- A harmless call the daily keep-awake job makes, so the free plan never pauses the project.
create or replace function public.money_ping() returns text
language sql security definer set search_path = '' as $$ select 'ok'::text $$;
revoke all on function public.money_ping() from public;
grant execute on function public.money_ping() to anon, authenticated;

-- Live updates: a capture on the phone shows up on the laptop within seconds.
do $$
begin
  alter publication supabase_realtime add table public.money_records;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.money_inbox;
exception when duplicate_object then null;
end $$;
