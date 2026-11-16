-- Gen Pedal Hub: shared data (accounts, community, rankings, clubs, events, routes).
-- Every table starts with ph_ so this can live in a Supabase project that
-- also holds other apps. Riders must be signed in to read or write anything.

-- ---------------------------------------------------------------- riders
create table ph_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  city text not null default '' check (char_length(city) <= 60),
  bike_kind text not null default '',
  level text not null default '',
  avatar_path text,
  created_at timestamptz not null default now()
);

create table ph_follows (
  follower uuid not null references ph_profiles (id) on delete cascade,
  followee uuid not null references ph_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index on ph_follows (followee);

-- ---------------------------------------------------------------- rides
-- A summary of each ride, uploaded from the phone. Rankings are worked out
-- from these rows. The limits reject numbers no cyclist could produce.
create table ph_rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  local_id text not null,
  title text not null default 'Ride' check (char_length(title) <= 80),
  started_at timestamptz not null,
  distance_m real not null check (distance_m >= 0 and distance_m <= 600000),
  moving_s integer not null check (moving_s >= 0 and moving_s <= 172800),
  elev_gain_m real not null default 0 check (elev_gain_m >= 0 and elev_gain_m <= 20000),
  max_speed_ms real not null default 0 check (max_speed_ms >= 0 and max_speed_ms <= 35),
  created_at timestamptz not null default now(),
  unique (user_id, local_id),
  -- An average above 60 km/h is not a bicycle.
  check (moving_s = 0 or distance_m / moving_s <= 16.7)
);
create index on ph_rides (started_at);
create index on ph_rides (user_id, started_at);

-- ---------------------------------------------------------------- feed
create table ph_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  photo_path text,
  ride_id uuid references ph_rides (id) on delete set null,
  created_at timestamptz not null default now(),
  check (body <> '' or photo_path is not null or ride_id is not null)
);
create index on ph_posts (created_at desc);

create table ph_likes (
  post_id uuid not null references ph_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table ph_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references ph_posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index on ph_comments (post_id, created_at);

-- ---------------------------------------------------------------- clubs
create table ph_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 50),
  about text not null default '' check (char_length(about) <= 500),
  city text not null default '' check (char_length(city) <= 60),
  owner_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index on ph_clubs (lower(name));

create table ph_club_members (
  club_id uuid not null references ph_clubs (id) on delete cascade,
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index on ph_club_members (user_id);

-- ---------------------------------------------------------------- events
create table ph_events (
  id uuid primary key default gen_random_uuid(),
  organiser_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  club_id uuid references ph_clubs (id) on delete set null,
  title text not null check (char_length(title) between 3 and 80),
  about text not null default '' check (char_length(about) <= 2000),
  place text not null default '' check (char_length(place) <= 120),
  starts_at timestamptz not null,
  distance_km real not null default 0 check (distance_km >= 0 and distance_km <= 2000),
  fee numeric(10, 2) not null default 0 check (fee >= 0),
  -- How to pay the fee, written by the organiser (for example a GCash number).
  pay_info text not null default '' check (char_length(pay_info) <= 500),
  created_at timestamptz not null default now()
);
create index on ph_events (starts_at);

create table ph_event_regs (
  event_id uuid not null references ph_events (id) on delete cascade,
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  race_no integer not null default 0,
  -- The payment reference the rider typed in after paying.
  pay_ref text not null default '' check (char_length(pay_ref) <= 80),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  unique (event_id, race_no)
);

create table ph_event_news (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references ph_events (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on ph_event_news (event_id, created_at desc);

-- ---------------------------------------------------------------- challenges
-- A challenge is a target over a period. A competition is the same thing
-- with a ranking: riders compete from wherever they are.
create table ph_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  about text not null default '' check (char_length(about) <= 500),
  kind text not null check (kind in ('distance', 'climb', 'rides')),
  -- km for distance, metres for climb, a count for rides. 0 means no target, ranking only.
  target real not null default 0 check (target >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid default auth.uid() references ph_profiles (id) on delete set null,
  competition boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (title, starts_at)
);

create table ph_challenge_members (
  challenge_id uuid not null references ph_challenges (id) on delete cascade,
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

-- ---------------------------------------------------------------- routes
create table ph_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  about text not null default '' check (char_length(about) <= 500),
  distance_m real not null check (distance_m > 0 and distance_m <= 600000),
  elev_gain_m real not null default 0 check (elev_gain_m >= 0),
  start_lat double precision not null check (start_lat between -90 and 90),
  start_lon double precision not null check (start_lon between -180 and 180),
  -- The line of the route as [[lat, lon], ...], thinned to a few hundred points.
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) between 2 and 600),
  created_at timestamptz not null default now()
);

create table ph_route_saves (
  route_id uuid not null references ph_routes (id) on delete cascade,
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (route_id, user_id)
);

-- Dangerous road reports. The app only shows the last 30 days.
create table ph_hazards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references ph_profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  kind text not null check (kind in ('pothole', 'traffic', 'flood', 'dogs', 'roadworks', 'other')),
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index on ph_hazards (created_at desc);

-- ================================================================ triggers

-- The rider who creates a club becomes its first member, as owner.
create function ph_club_add_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into ph_club_members (club_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end $$;
create trigger ph_club_add_owner after insert on ph_clubs
for each row execute function ph_club_add_owner();

-- Nobody can make themselves an owner by joining.
create function ph_club_member_guard() returns trigger
language plpgsql as $$
begin
  if new.role = 'owner' and not exists (select 1 from ph_clubs c where c.id = new.club_id and c.owner_id = new.user_id) then
    new.role := 'member';
  end if;
  return new;
end $$;
create trigger ph_club_member_guard before insert or update on ph_club_members
for each row execute function ph_club_member_guard();

-- Race numbers are handed out in order of registration, starting at 1.
create function ph_reg_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.event_id::text));
  select coalesce(max(race_no), 0) + 1 into new.race_no from ph_event_regs where event_id = new.event_id;
  new.paid := false;
  return new;
end $$;
create trigger ph_reg_before_insert before insert on ph_event_regs
for each row execute function ph_reg_before_insert();

-- A rider may change their payment reference. Only the organiser may mark it paid.
create function ph_reg_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare organiser uuid;
begin
  select organiser_id into organiser from ph_events where id = new.event_id;
  new.race_no := old.race_no;
  new.event_id := old.event_id;
  new.user_id := old.user_id;
  if auth.uid() is distinct from organiser then
    new.paid := old.paid;
  end if;
  return new;
end $$;
create trigger ph_reg_before_update before update on ph_event_regs
for each row execute function ph_reg_before_update();

-- ================================================================ who may do what
alter table ph_profiles enable row level security;
alter table ph_follows enable row level security;
alter table ph_rides enable row level security;
alter table ph_posts enable row level security;
alter table ph_likes enable row level security;
alter table ph_comments enable row level security;
alter table ph_clubs enable row level security;
alter table ph_club_members enable row level security;
alter table ph_events enable row level security;
alter table ph_event_regs enable row level security;
alter table ph_event_news enable row level security;
alter table ph_challenges enable row level security;
alter table ph_challenge_members enable row level security;
alter table ph_routes enable row level security;
alter table ph_route_saves enable row level security;
alter table ph_hazards enable row level security;

create policy read on ph_profiles for select to authenticated using (true);
create policy add_own on ph_profiles for insert to authenticated with check (id = auth.uid());
create policy edit_own on ph_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy read on ph_follows for select to authenticated using (true);
create policy add_own on ph_follows for insert to authenticated with check (follower = auth.uid());
create policy drop_own on ph_follows for delete to authenticated using (follower = auth.uid());

create policy read on ph_rides for select to authenticated using (true);
create policy add_own on ph_rides for insert to authenticated with check (user_id = auth.uid());
create policy edit_own on ph_rides for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy drop_own on ph_rides for delete to authenticated using (user_id = auth.uid());

create policy read on ph_posts for select to authenticated using (true);
create policy add_own on ph_posts for insert to authenticated with check (user_id = auth.uid());
create policy drop_own on ph_posts for delete to authenticated using (user_id = auth.uid());

create policy read on ph_likes for select to authenticated using (true);
create policy add_own on ph_likes for insert to authenticated with check (user_id = auth.uid());
create policy drop_own on ph_likes for delete to authenticated using (user_id = auth.uid());

create policy read on ph_comments for select to authenticated using (true);
create policy add_own on ph_comments for insert to authenticated with check (user_id = auth.uid());
create policy drop_own on ph_comments for delete to authenticated using (user_id = auth.uid());

create policy read on ph_clubs for select to authenticated using (true);
create policy add_own on ph_clubs for insert to authenticated with check (owner_id = auth.uid());
create policy edit_own on ph_clubs for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy drop_own on ph_clubs for delete to authenticated using (owner_id = auth.uid());

create policy read on ph_club_members for select to authenticated using (true);
create policy join_in on ph_club_members for insert to authenticated with check (user_id = auth.uid());
create policy leave_own on ph_club_members for delete to authenticated using (user_id = auth.uid() and role <> 'owner');

create policy read on ph_events for select to authenticated using (true);
create policy add_own on ph_events for insert to authenticated with check (organiser_id = auth.uid());
create policy edit_own on ph_events for update to authenticated using (organiser_id = auth.uid()) with check (organiser_id = auth.uid());
create policy drop_own on ph_events for delete to authenticated using (organiser_id = auth.uid());

-- A registration (with its payment reference) is private to the rider and the organiser.
-- Everyone else sees the participant list through ph_event_participants() below.
create policy read on ph_event_regs for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from ph_events e where e.id = event_id and e.organiser_id = auth.uid())
);
create policy register on ph_event_regs for insert to authenticated with check (user_id = auth.uid());
create policy edit on ph_event_regs for update to authenticated using (
  user_id = auth.uid() or exists (select 1 from ph_events e where e.id = event_id and e.organiser_id = auth.uid())
);
create policy withdraw on ph_event_regs for delete to authenticated using (user_id = auth.uid());

create policy read on ph_event_news for select to authenticated using (true);
create policy add_own on ph_event_news for insert to authenticated with check (
  exists (select 1 from ph_events e where e.id = event_id and e.organiser_id = auth.uid())
);
create policy drop_own on ph_event_news for delete to authenticated using (
  exists (select 1 from ph_events e where e.id = event_id and e.organiser_id = auth.uid())
);

create policy read on ph_challenges for select to authenticated using (true);
create policy add_own on ph_challenges for insert to authenticated with check (created_by = auth.uid());
create policy drop_own on ph_challenges for delete to authenticated using (created_by = auth.uid());

create policy read on ph_challenge_members for select to authenticated using (true);
create policy join_in on ph_challenge_members for insert to authenticated with check (user_id = auth.uid());
create policy leave_own on ph_challenge_members for delete to authenticated using (user_id = auth.uid());

create policy read on ph_routes for select to authenticated using (true);
create policy add_own on ph_routes for insert to authenticated with check (user_id = auth.uid());
create policy drop_own on ph_routes for delete to authenticated using (user_id = auth.uid());

create policy read on ph_route_saves for select to authenticated using (true);
create policy add_own on ph_route_saves for insert to authenticated with check (user_id = auth.uid());
create policy drop_own on ph_route_saves for delete to authenticated using (user_id = auth.uid());

create policy read on ph_hazards for select to authenticated using (true);
create policy add_own on ph_hazards for insert to authenticated with check (user_id = auth.uid());
create policy drop_own on ph_hazards for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on
  ph_profiles, ph_follows, ph_rides, ph_posts, ph_likes, ph_comments, ph_clubs, ph_club_members,
  ph_events, ph_event_regs, ph_event_news, ph_challenges, ph_challenge_members, ph_routes,
  ph_route_saves, ph_hazards
to authenticated;

-- ================================================================ questions the app asks

-- Weeks and months follow Philippine time, where the app starts out.
create function ph_period_start(p_period text) returns timestamptz
language sql stable as $$
  select case when p_period = 'month'
    then date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
    else date_trunc('week', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
  end
$$;

-- Top riders this week or month. p_metric: distance (km), climb (m),
-- speed (km/h, riders with at least 20 km only) or longest (km, single ride).
create function ph_leaderboard(p_period text, p_metric text, p_club uuid default null, p_limit integer default 50)
returns table (user_id uuid, name text, city text, value double precision)
language sql stable as $$
  select p.id, p.name, p.city,
    case p_metric
      when 'climb' then sum(r.elev_gain_m)::double precision
      when 'speed' then (sum(r.distance_m) / nullif(sum(r.moving_s), 0) * 3.6)::double precision
      when 'longest' then (max(r.distance_m) / 1000)::double precision
      else (sum(r.distance_m) / 1000)::double precision
    end as value
  from ph_rides r
  join ph_profiles p on p.id = r.user_id
  where r.started_at >= ph_period_start(p_period)
    and (p_club is null or exists (select 1 from ph_club_members m where m.club_id = p_club and m.user_id = r.user_id))
  group by p.id, p.name, p.city
  having p_metric <> 'speed' or sum(r.distance_m) >= 20000
  order by value desc nulls last, p.name
  limit least(greatest(p_limit, 1), 100)
$$;

-- Clubs ranked by the distance their members rode this week or month.
create function ph_club_ranking(p_period text)
returns table (club_id uuid, name text, city text, members bigint, value double precision)
language sql stable as $$
  select c.id, c.name, c.city,
    (select count(*) from ph_club_members m where m.club_id = c.id),
    coalesce((
      select sum(r.distance_m) / 1000
      from ph_rides r join ph_club_members m on m.user_id = r.user_id
      where m.club_id = c.id and r.started_at >= ph_period_start(p_period)
    ), 0)::double precision as value
  from ph_clubs c
  order by value desc, c.name
  limit 100
$$;

create function ph_clubs_list()
returns table (id uuid, name text, about text, city text, owner_id uuid, members bigint, joined boolean)
language sql stable as $$
  select c.id, c.name, c.about, c.city, c.owner_id,
    (select count(*) from ph_club_members m where m.club_id = c.id),
    exists (select 1 from ph_club_members m where m.club_id = c.id and m.user_id = auth.uid())
  from ph_clubs c
  order by 6 desc, c.name
  limit 200
$$;

-- The feed: everyone's posts, newest first, with the rider's own posts and
-- the people they follow marked so the app can show those first if it wants.
create function ph_feed(p_before timestamptz default null, p_user uuid default null, p_limit integer default 30)
returns table (
  id uuid, user_id uuid, name text, body text, photo_path text, created_at timestamptz,
  ride_title text, ride_distance_m real, ride_moving_s integer, ride_elev_gain_m real,
  likes bigint, comments bigint, liked boolean, following boolean
)
language sql stable as $$
  select po.id, po.user_id, p.name, po.body, po.photo_path, po.created_at,
    r.title, r.distance_m, r.moving_s, r.elev_gain_m,
    (select count(*) from ph_likes l where l.post_id = po.id),
    (select count(*) from ph_comments c where c.post_id = po.id),
    exists (select 1 from ph_likes l where l.post_id = po.id and l.user_id = auth.uid()),
    exists (select 1 from ph_follows f where f.follower = auth.uid() and f.followee = po.user_id)
  from ph_posts po
  join ph_profiles p on p.id = po.user_id
  left join ph_rides r on r.id = po.ride_id
  where (p_before is null or po.created_at < p_before)
    and (p_user is null or po.user_id = p_user)
  order by po.created_at desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- A rider's public page.
create function ph_rider(p_user uuid)
returns table (
  id uuid, name text, city text, bike_kind text, level text, created_at timestamptz,
  followers bigint, following bigint, i_follow boolean,
  rides bigint, distance_km double precision, climb_m double precision
)
language sql stable as $$
  select p.id, p.name, p.city, p.bike_kind, p.level, p.created_at,
    (select count(*) from ph_follows f where f.followee = p.id),
    (select count(*) from ph_follows f where f.follower = p.id),
    exists (select 1 from ph_follows f where f.follower = auth.uid() and f.followee = p.id),
    (select count(*) from ph_rides r where r.user_id = p.id),
    coalesce((select sum(r.distance_m) / 1000 from ph_rides r where r.user_id = p.id), 0)::double precision,
    coalesce((select sum(r.elev_gain_m) from ph_rides r where r.user_id = p.id), 0)::double precision
  from ph_profiles p where p.id = p_user
$$;

create function ph_events_list()
returns table (
  id uuid, organiser_id uuid, organiser text, title text, about text, place text, starts_at timestamptz,
  distance_km real, fee numeric, pay_info text, riders bigint, my_race_no integer, my_paid boolean, my_pay_ref text
)
language sql stable as $$
  select e.id, e.organiser_id, p.name, e.title, e.about, e.place, e.starts_at, e.distance_km, e.fee, e.pay_info,
    (select count(*) from ph_event_regs g where g.event_id = e.id),
    me.race_no, me.paid, me.pay_ref
  from ph_events e
  join ph_profiles p on p.id = e.organiser_id
  left join ph_event_regs me on me.event_id = e.id and me.user_id = auth.uid()
  where e.starts_at >= now() - interval '2 days'
  order by e.starts_at
  limit 200
$$;

-- The participant list. Payment details are only shown to the organiser.
create function ph_event_participants(p_event uuid)
returns table (user_id uuid, name text, race_no integer, paid boolean, pay_ref text)
language sql stable security definer set search_path = public as $$
  select g.user_id, p.name, g.race_no,
    case when e.organiser_id = auth.uid() or g.user_id = auth.uid() then g.paid end,
    case when e.organiser_id = auth.uid() or g.user_id = auth.uid() then g.pay_ref end
  from ph_event_regs g
  join ph_events e on e.id = g.event_id
  join ph_profiles p on p.id = g.user_id
  where g.event_id = p_event and auth.uid() is not null
  order by g.race_no
$$;

-- Makes sure this month's three standard challenges exist. Safe to call any time.
create function ph_ensure_monthly() returns void
language plpgsql security definer set search_path = public as $$
declare
  s timestamptz := date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  e timestamptz := (date_trunc('month', now() at time zone 'Asia/Manila') + interval '1 month') at time zone 'Asia/Manila';
  m text := to_char(now() at time zone 'Asia/Manila', 'FMMonth');
begin
  insert into ph_challenges (title, about, kind, target, starts_at, ends_at, created_by, competition) values
    (m || ' 200 km', 'Ride 200 km in total this month.', 'distance', 200, s, e, null, false),
    (m || ' 1,000 m climb', 'Climb 1,000 metres in total this month.', 'climb', 1000, s, e, null, false),
    (m || ' 10 rides', 'Go out on your bike 10 times this month.', 'rides', 10, s, e, null, false)
  on conflict (title, starts_at) do nothing;
end $$;

create function ph_challenge_value(p_kind text, p_user uuid, p_from timestamptz, p_to timestamptz)
returns double precision language sql stable as $$
  select coalesce(case p_kind
    when 'climb' then sum(r.elev_gain_m)
    when 'rides' then count(*)
    else sum(r.distance_m) / 1000
  end, 0)::double precision
  from ph_rides r
  where r.user_id = p_user and r.started_at >= p_from and r.started_at < p_to
$$;

create function ph_challenges_list()
returns table (
  id uuid, title text, about text, kind text, target real, starts_at timestamptz, ends_at timestamptz,
  competition boolean, created_by uuid, riders bigint, joined boolean, my_value double precision
)
language sql stable as $$
  select c.id, c.title, c.about, c.kind, c.target, c.starts_at, c.ends_at, c.competition, c.created_by,
    (select count(*) from ph_challenge_members m where m.challenge_id = c.id),
    exists (select 1 from ph_challenge_members m where m.challenge_id = c.id and m.user_id = auth.uid()),
    ph_challenge_value(c.kind, auth.uid(), c.starts_at, c.ends_at)
  from ph_challenges c
  where c.ends_at >= now() - interval '3 days'
  order by c.competition, c.ends_at
  limit 100
$$;

-- The ranking inside one challenge or competition.
create function ph_challenge_board(p_challenge uuid)
returns table (user_id uuid, name text, value double precision)
language sql stable as $$
  select p.id, p.name, ph_challenge_value(c.kind, p.id, c.starts_at, c.ends_at) as value
  from ph_challenges c
  join ph_challenge_members m on m.challenge_id = c.id
  join ph_profiles p on p.id = m.user_id
  where c.id = p_challenge
  order by value desc, p.name
  limit 100
$$;

-- Shared routes, most saved first.
create function ph_routes_list()
returns table (
  id uuid, user_id uuid, rider text, name text, about text, distance_m real, elev_gain_m real,
  start_lat double precision, start_lon double precision, created_at timestamptz, saves bigint, saved boolean
)
language sql stable as $$
  select r.id, r.user_id, p.name, r.name, r.about, r.distance_m, r.elev_gain_m, r.start_lat, r.start_lon, r.created_at,
    (select count(*) from ph_route_saves s where s.route_id = r.id),
    exists (select 1 from ph_route_saves s where s.route_id = r.id and s.user_id = auth.uid())
  from ph_routes r join ph_profiles p on p.id = r.user_id
  order by 11 desc, r.created_at desc
  limit 200
$$;

-- Only signed-in riders may call these. (Named one by one so other apps'
-- functions in the same project are left alone.)
revoke execute on function
  ph_period_start(text), ph_leaderboard(text, text, uuid, integer), ph_club_ranking(text), ph_clubs_list(),
  ph_feed(timestamptz, uuid, integer), ph_rider(uuid), ph_events_list(), ph_event_participants(uuid),
  ph_ensure_monthly(), ph_challenge_value(text, uuid, timestamptz, timestamptz), ph_challenges_list(),
  ph_challenge_board(uuid), ph_routes_list()
from public, anon;
grant execute on function
  ph_period_start(text), ph_leaderboard(text, text, uuid, integer), ph_club_ranking(text), ph_clubs_list(),
  ph_feed(timestamptz, uuid, integer), ph_rider(uuid), ph_events_list(), ph_event_participants(uuid),
  ph_ensure_monthly(), ph_challenge_value(text, uuid, timestamptz, timestamptz), ph_challenges_list(),
  ph_challenge_board(uuid), ph_routes_list()
to authenticated;
