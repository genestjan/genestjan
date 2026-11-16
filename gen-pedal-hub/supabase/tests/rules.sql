-- Checks the access rules, triggers and ranking queries. Run against a scratch
-- database that has the migration applied (see README). Any failure stops it.
\set ON_ERROR_STOP 1
\set a '11111111-1111-1111-1111-111111111111'
\set b '22222222-2222-2222-2222-222222222222'
\set c '33333333-3333-3333-3333-333333333333'
insert into auth.users values (:'a'), (:'b'), (:'c');

create schema t;
create function t.expect(ok boolean, what text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create function t.denied(q text, what text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'ok: % (refused: %)', what, sqlerrm; return; end;
  raise exception 'FAILED: % was allowed', what;
end $$;
grant usage on schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- ---- signed out: nothing is readable
set role anon;
select t.denied('select * from ph_profiles', 'signed-out riders cannot read profiles');
select t.denied('select * from ph_leaderboard(''week'', ''distance'')', 'signed-out riders cannot read rankings');
reset role;

-- ---- rider A
set role authenticated;
select set_config('request.jwt.claim.sub', :'a', false);
insert into ph_profiles (id, name, city) values (:'a', 'Ana', 'General Santos');
select t.denied(format('insert into ph_profiles (id, name) values (%L, ''Fake'')', :'b'), 'A cannot create a profile for B');
insert into ph_rides (local_id, started_at, distance_m, moving_s, elev_gain_m) values
  ('a1', now(), 40000, 7200, 300), ('a2', now(), 25000, 3600, 100);
insert into ph_rides (local_id, started_at, distance_m, moving_s) values ('a1', now(), 41000, 7200)
  on conflict (user_id, local_id) do update set distance_m = excluded.distance_m;
select t.expect((select count(*) = 2 from ph_rides), 'uploading the same ride twice does not duplicate it');
select t.denied('insert into ph_rides (local_id, started_at, distance_m, moving_s) values (''x'', now(), 100000, 3600)', 'a 100 km/h ride is refused');
insert into ph_clubs (name, city) values ('GenSan Riders', 'General Santos');
select t.expect((select role = 'owner' from ph_club_members where user_id = :'a'), 'club creator becomes owner');
insert into ph_events (title, place, starts_at, distance_km, fee, pay_info) values ('Sunday Fun Ride', 'Plaza', now() + interval '7 days', 50, 300, 'GCash 0917');
insert into ph_posts (body) values ('First ride with the app');
select t.denied('insert into ph_posts (body) values ('''')', 'an empty post is refused');
insert into ph_routes (name, distance_m, elev_gain_m, start_lat, start_lon, points) values ('Coast loop', 30000, 120, 6.1, 125.1, '[[6.1,125.1],[6.2,125.2]]');
insert into ph_hazards (lat, lon, kind, note) values (6.1, 125.1, 'pothole', 'Deep hole near the bridge');
select ph_ensure_monthly();
select ph_ensure_monthly();
select t.expect((select count(*) = 3 from ph_challenges), 'monthly challenges are created once');

-- ---- rider B
select set_config('request.jwt.claim.sub', :'b', false);
insert into ph_profiles (id, name, city) values (:'b', 'Ben', 'Davao');
insert into ph_rides (local_id, started_at, distance_m, moving_s, elev_gain_m) values ('b1', now(), 90000, 10800, 900);
insert into ph_rides (local_id, started_at, distance_m, moving_s) values ('b0', now() - interval '70 days', 500000, 86400);
with x as (update ph_rides set distance_m = 1 where user_id = '11111111-1111-1111-1111-111111111111' returning 1)
select t.expect((select count(*) = 0 from x), 'B cannot change A''s ride');
select t.denied(format('insert into ph_rides (user_id, local_id, started_at, distance_m, moving_s) values (%L, ''z'', now(), 1000, 600)', :'a'), 'B cannot upload a ride as A');
insert into ph_follows (follower, followee) values (:'b', :'a');
insert into ph_likes (post_id) select id from ph_posts;
insert into ph_comments (post_id, body) select id, 'Nice one' from ph_posts;
insert into ph_club_members (club_id, role) select id, 'owner' from ph_clubs;
select t.expect((select role = 'member' from ph_club_members where user_id = :'b'), 'joining as owner is turned into member');
insert into ph_event_regs (event_id, race_no, paid) select id, 99, true from ph_events;
select t.expect((select race_no = 1 and not paid from ph_event_regs where user_id = :'b'), 'race number is given by the server and paid starts false');
update ph_event_regs set paid = true, pay_ref = 'REF123', race_no = 7 where user_id = :'b';
select t.expect((select not paid and pay_ref = 'REF123' and race_no = 1 from ph_event_regs where user_id = :'b'), 'a rider can add a payment reference but cannot mark themselves paid');
select t.denied('insert into ph_event_news (event_id, body) select id, ''hi'' from ph_events', 'only the organiser can post event news');
insert into ph_route_saves (route_id) select id from ph_routes;
insert into ph_challenge_members (challenge_id) select id from ph_challenges;
with x as (delete from ph_posts returning 1)
select t.expect((select count(*) = 0 from x), 'B cannot delete A''s post');

-- ---- rider C registers too
select set_config('request.jwt.claim.sub', :'c', false);
insert into ph_profiles (id, name) values (:'c', 'Cora');
insert into ph_event_regs (event_id) select id from ph_events;
select t.expect((select race_no = 2 from ph_event_regs where user_id = :'c'), 'second rider gets race number 2');
select t.expect((select count(*) = 1 from ph_event_regs), 'C cannot see B''s registration row');
select t.expect((select count(*) = 2 and bool_and(pay_ref is null or user_id = '33333333-3333-3333-3333-333333333333') from ph_event_participants((select id from ph_events))), 'participant list shows everyone but hides other riders'' payment details');

-- ---- back to A (organiser): rankings and lists
select set_config('request.jwt.claim.sub', :'a', false);
update ph_event_regs set paid = true where user_id = :'b';
select t.expect((select paid from ph_event_regs where user_id = :'b'), 'the organiser can mark a rider as paid');
insert into ph_event_news (event_id, body) select id, 'Start moved to 5 am' from ph_events;
select t.expect((select array_agg(name order by value desc) = array['Ben','Ana'] from ph_leaderboard('week', 'distance')), 'distance ranking: Ben then Ana, old rides left out');
select t.expect((select round(value::numeric, 1) = 90.0 from ph_leaderboard('week', 'distance') limit 1), 'distance ranking is in km for this week only');
select t.expect((select name = 'Ben' and round(value::numeric) = 900 from ph_leaderboard('month', 'climb') limit 1), 'climbing ranking');
select t.expect((select name = 'Ben' and round(value::numeric) = 30 from ph_leaderboard('week', 'speed') limit 1), 'speed ranking in km/h');
select t.expect((select count(*) = 2 from ph_leaderboard('week', 'distance', (select id from ph_clubs))), 'ranking inside one club');
select t.expect((select members = 2 and round(value::numeric) = 156 from ph_club_ranking('week')), 'club ranking adds up its members');
select t.expect((select likes = 1 and comments = 1 and not liked from ph_feed()), 'feed counts likes and comments');
select t.expect((select followers = 1 and rides = 2 from ph_rider(:'a')), 'rider page totals');
select t.expect((select riders = 2 and my_race_no is null from ph_events_list()), 'event list counts riders');
select t.expect((select saves = 1 and not saved from ph_routes_list()), 'route list counts saves');
select t.expect((select count(*) = 3 and bool_and(riders = 1) from ph_challenges_list()), 'challenge list');
select t.expect((select name = 'Ben' and round(value::numeric) = 90 from ph_challenge_board((select id from ph_challenges where kind = 'distance')) limit 1), 'challenge ranking only counts rides inside the month');
with x as (delete from ph_club_members where user_id = '11111111-1111-1111-1111-111111111111' returning 1)
select t.expect((select count(*) = 0 from x), 'a club owner cannot leave their own club');
reset role;
select 'ALL RULES PASSED' as result;
