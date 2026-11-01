-- Fetch GenSan database. Run once in Supabase: SQL Editor > New query > paste > Run.
-- Each row keeps the app's object in `data`; key fields are copied to columns for security rules.

create table if not exists profiles (id text primary key, role text, data jsonb not null, updated_at timestamptz default now());
create table if not exists drivers  (id text primary key, online boolean default false, data jsonb not null, updated_at timestamptz default now());
create table if not exists trips    (id text primary key, customer_id text not null, driver_id text not null, status text, data jsonb not null, updated_at timestamptz default now());
create table if not exists messages (id text primary key, trip_id text not null references trips(id) on delete cascade, data jsonb not null, created_at timestamptz default now());
create table if not exists wallets  (id text primary key, data jsonb not null, updated_at timestamptz default now());

create index if not exists trips_customer on trips(customer_id);
create index if not exists trips_driver on trips(driver_id);
create index if not exists messages_trip on messages(trip_id);

alter table profiles enable row level security;
alter table drivers  enable row level security;
alter table trips    enable row level security;
alter table messages enable row level security;
alter table wallets  enable row level security;

-- Profiles: you see and edit only your own. ID photos are never visible to other users.
create policy "own profile read"   on profiles for select using (id = auth.uid()::text);
create policy "own profile insert" on profiles for insert with check (id = auth.uid()::text);
create policy "own profile update" on profiles for update using (id = auth.uid()::text);

-- Drivers: any signed-in user can see drivers (to choose one); drivers edit only themselves.
create policy "drivers readable" on drivers for select using (auth.role() = 'authenticated');
create policy "own driver insert" on drivers for insert with check (id = auth.uid()::text
  and exists (select 1 from profiles p where p.id = auth.uid()::text and p.data->>'verified' = 'approved'));
create policy "own driver update" on drivers for update using (id = auth.uid()::text);

-- Trips: only the customer and the driver on the trip.
create policy "trip parties read"   on trips for select using (auth.uid()::text in (customer_id, driver_id));
create policy "customer creates"    on trips for insert with check (customer_id = auth.uid()::text
  and exists (select 1 from profiles p where p.id = auth.uid()::text and p.data->>'verified' = 'approved'));
create policy "trip parties update" on trips for update using (auth.uid()::text in (customer_id, driver_id));

-- Messages: only the two people on the trip.
create policy "chat read" on messages for select using (exists (select 1 from trips t where t.id = trip_id and auth.uid()::text in (t.customer_id, t.driver_id)));
create policy "chat send" on messages for insert with check (exists (select 1 from trips t where t.id = trip_id and auth.uid()::text in (t.customer_id, t.driver_id)));

-- Wallets: read your own; only the database changes points.
create policy "own wallet" on wallets for select using (id = auth.uid()::text);

-- Users cannot approve themselves: "verified" only changes through the dashboard (service role).
create or replace function guard_profile() returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    new.data := jsonb_set(new.data, '{verified}', to_jsonb(coalesce(case when tg_op = 'UPDATE' then old.data->>'verified' end, 'pending')));
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_profile on profiles;
create trigger guard_profile before insert or update on profiles for each row execute function guard_profile();

-- When the driver confirms payment: award suki points, count the trip, update the driver's rating.
-- 1 point per ₱10 paid (tips and pabili item costs excluded); points used are deducted.
create or replace function settle_trip() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; earned int; r numeric; n int;
begin
  if coalesce((d->>'paid')::boolean, false) and not coalesce((old.data->>'paid')::boolean, false) then
    earned := floor(greatest(0, (d->>'finalFare')::numeric - coalesce((d->>'tip')::numeric, 0) - coalesce((d->>'itemsCost')::numeric, 0)) / 10);
    insert into wallets (id, data) values (new.customer_id, jsonb_build_object('id', new.customer_id, 'points', 0, 'completedTrips', 0))
      on conflict (id) do nothing;
    update wallets set data = jsonb_build_object('id', id,
        'points', greatest(0, (data->>'points')::int - coalesce((d->>'pointsUsed')::int, 0) + earned),
        'completedTrips', (data->>'completedTrips')::int + 1), updated_at = now()
      where id = new.customer_id;
    if coalesce((d->>'ratingByCustomer')::int, 0) > 0 then
      select (data->>'rating')::numeric, (data->>'ratingCount')::int into r, n from drivers where id = new.driver_id;
      update drivers set data = data || jsonb_build_object('rating', (r * n + (d->>'ratingByCustomer')::int) / (n + 1), 'ratingCount', n + 1)
        where id = new.driver_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists settle_trip on trips;
create trigger settle_trip after update on trips for each row execute function settle_trip();

-- Drivers cannot edit their own rating. The settle trigger (runs as the owner, postgres) can.
create or replace function guard_driver() returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' and current_user <> 'postgres' then
    if tg_op = 'UPDATE' then
      new.data := new.data || jsonb_build_object('rating', old.data->'rating', 'ratingCount', old.data->'ratingCount');
    else
      new.data := new.data || '{"rating":5,"ratingCount":0}'::jsonb;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_driver on drivers;
create trigger guard_driver before insert or update on drivers for each row execute function guard_driver();

-- Live updates for the apps.
alter publication supabase_realtime add table drivers, trips, messages, wallets, profiles;
