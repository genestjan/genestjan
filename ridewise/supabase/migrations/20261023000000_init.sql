-- RideWise initial schema. Optional: the app works local-only without it.
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

create extension if not exists postgis;

-- Users -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  ride_style text check (ride_style in ('relaxed', 'moderate', 'experienced')),
  bike_profile jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No medical or emergency-contact columns on purpose: that data stays on the device.

-- Ride plans --------------------------------------------------------------
create table public.ride_plans (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  start_point geography(Point, 4326),
  end_point geography(Point, 4326),
  route_geom geography(LineString, 4326),
  route_provider text,
  departure_local text not null check (departure_local ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  time_zone text not null default 'Asia/Manila',
  expected_speed_kmh numeric check (expected_speed_kmh > 0 and expected_speed_kmh <= 45),
  distance_m numeric check (distance_m >= 0),
  riding_min numeric,
  total_min numeric,
  status text not null default 'draft' check (status in ('draft', 'planned', 'riding', 'completed')),
  payload jsonb not null, -- full RidePlan document used by the client
  share_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ride_plans_owner_idx on public.ride_plans (owner_id, updated_at desc);
create index ride_plans_route_gix on public.ride_plans using gist (route_geom);

-- Pit stops ---------------------------------------------------------------
create table public.pit_stops (
  id text primary key,
  ride_id text not null references public.ride_plans (id) on delete cascade,
  position int not null check (position >= 0),
  location_ref text, -- e.g. osm:node/123 or user:<id>
  name text not null,
  point geography(Point, 4326) not null,
  category text not null,
  route_km numeric not null check (route_km >= 0),
  segment_km numeric,
  est_arrival timestamptz,
  est_departure timestamptz,
  planned_min int not null check (planned_min between 0 and 600),
  verification text not null check (verification in ('osm-listed', 'user-unverified', 'user-verified', 'reported-closed')),
  opening_hours text,
  detour_km numeric not null default 0 check (detour_km >= 0),
  notes text,
  status text not null default 'planned' check (status in ('planned', 'arrived', 'completed', 'skipped')),
  unique (ride_id, position)
);
create index pit_stops_ride_idx on public.pit_stops (ride_id);
create index pit_stops_point_gix on public.pit_stops using gist (point);

-- Ride sessions -----------------------------------------------------------
create table public.ride_sessions (
  id text primary key,
  ride_id text not null references public.ride_plans (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  finished_at timestamptz,
  elapsed_min numeric,
  moving_min numeric,
  distance_km numeric,
  pause_events jsonb not null default '[]'::jsonb,
  stop_events jsonb not null default '[]'::jsonb,
  checkins jsonb not null default '[]'::jsonb,
  notes text,
  check (finished_at is null or finished_at >= started_at)
);
create index ride_sessions_owner_idx on public.ride_sessions (owner_id, started_at desc);

-- Checklist records -------------------------------------------------------
create table public.checklist_records (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  ride_id text references public.ride_plans (id) on delete cascade,
  category text not null check (category in ('pre-ride', 'pit-stop', 'post-ride')),
  items jsonb not null,
  states jsonb not null,
  updated_at timestamptz not null default now()
);
create index checklist_owner_idx on public.checklist_records (owner_id);

-- Group memberships -------------------------------------------------------
create table public.group_memberships (
  group_id text not null,
  ride_id text not null references public.ride_plans (id) on delete cascade,
  participant_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'rider' check (role in ('organizer', 'rider', 'viewer')),
  permissions jsonb not null default '{"view": true}'::jsonb,
  primary key (ride_id, participant_id)
);
create index group_memberships_participant_idx on public.group_memberships (participant_id);

-- Row Level Security ------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.ride_plans enable row level security;
alter table public.pit_stops enable row level security;
alter table public.ride_sessions enable row level security;
alter table public.checklist_records enable row level security;
alter table public.group_memberships enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.is_ride_member(rid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_memberships m where m.ride_id = rid and m.participant_id = auth.uid());
$$;

create policy "owner manages plan" on public.ride_plans for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "members read plan" on public.ride_plans for select using (public.is_ride_member(id));

create policy "owner manages stops" on public.pit_stops for all
  using (exists (select 1 from ride_plans p where p.id = ride_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from ride_plans p where p.id = ride_id and p.owner_id = auth.uid()));
create policy "members read stops" on public.pit_stops for select using (public.is_ride_member(ride_id));

create policy "own sessions" on public.ride_sessions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own checklists" on public.checklist_records for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "organizer manages members" on public.group_memberships for all
  using (exists (select 1 from ride_plans p where p.id = ride_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from ride_plans p where p.id = ride_id and p.owner_id = auth.uid()));
create policy "member sees own membership" on public.group_memberships for select using (participant_id = auth.uid());

-- Keep updated_at honest
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger ride_plans_touch before update on public.ride_plans for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
