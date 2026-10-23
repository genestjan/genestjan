-- Access-rule tests. Run with: psql -v ON_ERROR_STOP=1 -f tests/rls.sql (after stub + migrations).
begin;
create schema if not exists t;
create table if not exists t.results (name text, ok boolean);
create or replace function t.ok(c boolean, name text) returns void language plpgsql as $$ begin insert into t.results values (name, coalesce(c, false)); end $$;
create or replace function t.login(u uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); end $$;
create or replace function t.count(q text) returns bigint language plpgsql as $$ declare n bigint; begin execute q into n; return n; end $$;
create or replace function t.denied(q text) returns boolean language plpgsql as $$ begin
  begin execute q; exception when others then return true; end; return false; end $$;
grant usage on schema t to authenticated, anon;
grant all on all tables in schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- people
insert into auth.users (id) values
 ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2'),
 ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2'), ('00000000-0000-0000-0000-0000000000b3'),
 ('00000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000e1');
insert into public.memberships values
 ('00000000-0000-0000-0000-0000000000a1','admin','active'), ('00000000-0000-0000-0000-0000000000c1','coach','active'),
 ('00000000-0000-0000-0000-0000000000c2','coach','active'), ('00000000-0000-0000-0000-0000000000b1','parent','active'),
 ('00000000-0000-0000-0000-0000000000b2','parent','active'), ('00000000-0000-0000-0000-0000000000b3','parent','active'),
 ('00000000-0000-0000-0000-0000000000e1','coach','pending');
insert into public.teams (id,name,programme,age_band) values
 ('10000000-0000-0000-0000-000000000001','Rangers U10','rangers','U10'), ('10000000-0000-0000-0000-000000000002','Gila U12','gila','U12');
insert into public.team_staff values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1',true),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c2',true),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e1',false);
insert into public.players (id,team_id,first_name) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Ana'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Ben'),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Carlo');
insert into public.player_private values
 ('20000000-0000-0000-0000-000000000001','{"allergies":"nuts"}'), ('20000000-0000-0000-0000-000000000002','{"allergies":"none"}');
insert into public.player_guardians (player_id,user_id) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b2'),
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b3');

set role authenticated;
-- coach C1 writes records
select t.login('00000000-0000-0000-0000-0000000000c1');
insert into public.records (id,kind,team_id,player_id,visibility,data) values
 ('30000000-0000-0000-0000-000000000001','assessment_pub','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"strength":"touch"}'),
 ('30000000-0000-0000-0000-000000000002','assessment','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','coach','{"coachNote":"private"}'),
 ('30000000-0000-0000-0000-000000000003','event','10000000-0000-0000-0000-000000000001',null,'team','{"title":"Training"}'),
 ('30000000-0000-0000-0000-000000000004','announcement','10000000-0000-0000-0000-000000000001',null,'club','{"title":"Club news"}');
select t.ok(public.is_coach_of('10000000-0000-0000-0000-000000000001'), 'coach sees own team');
select t.ok(t.denied($q$insert into public.records (id,kind,team_id,visibility,data) values (gen_random_uuid(),'event','10000000-0000-0000-0000-000000000002','team','{}')$q$), 'coach cannot write to another team');
select t.ok(t.count('select count(*) from public.players') = 2, 'coach C1 sees only their 2 players');
select t.ok(t.count('select count(*) from public.player_private') = 2, 'coach C1 sees private info of their players');
select t.ok(t.count('select count(*) from public.records') = 4, 'coach C1 sees all 4 records');

-- parent B1 (child Ana)
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count('select count(*) from public.players') = 1, 'parent sees only own child');
select t.ok(t.count($q$select count(*) from public.players where first_name='Ben'$q$) = 0, 'parent cannot see another family''s child');
select t.ok(t.count('select count(*) from public.player_private') = 1, 'parent sees own child private info only');
select t.ok(t.count($q$select count(*) from public.records where kind='assessment_pub'$q$) = 1, 'parent sees published review of own child');
select t.ok(t.count($q$select count(*) from public.records where kind='assessment'$q$) = 0, 'parent cannot see coach-only notes');
select t.ok(t.count($q$select count(*) from public.records where kind='event'$q$) = 1, 'parent sees team event');
select t.ok(t.count($q$select count(*) from public.records where kind='announcement'$q$) = 1, 'parent sees club announcement');
insert into public.records (id,kind,team_id,player_id,visibility,data,author) values
 ('30000000-0000-0000-0000-000000000010','availability','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"status":"going"}','00000000-0000-0000-0000-0000000000b1'),
 ('30000000-0000-0000-0000-000000000011','message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"body":"Ana is sick today"}','00000000-0000-0000-0000-0000000000b1');
insert into public.records (id,kind,team_id,player_id,visibility,data,author) values ('30000000-0000-0000-0000-000000000013','seen','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"ref":"x"}','00000000-0000-0000-0000-0000000000b1');
select t.ok(t.denied($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'availability','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','family','{}','00000000-0000-0000-0000-0000000000b1')$q$), 'parent cannot reply for another family''s child');
select t.ok(t.denied($q$insert into public.records (id,kind,team_id,visibility,data,author) values (gen_random_uuid(),'event','10000000-0000-0000-0000-000000000001','team','{}','00000000-0000-0000-0000-0000000000b1')$q$), 'parent cannot create events');
select t.ok(t.denied($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'charge','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"status":"paid"}','00000000-0000-0000-0000-0000000000b1')$q$), 'parent cannot create or mark charges');
select t.ok(t.denied($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'availability','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','family','{}','00000000-0000-0000-0000-0000000000b1')$q$), 'parent cannot point a reply at another team');
select t.ok(t.denied($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{}','00000000-0000-0000-0000-0000000000c1')$q$), 'parent cannot post as someone else');
update public.records set data = '{"title":"hacked"}' where id = '30000000-0000-0000-0000-000000000003';
select t.ok(t.count($q$select count(*) from public.records where data->>'title' = 'hacked'$q$) = 0, 'parent cannot edit coach records');
select t.ok(t.denied($q$insert into public.memberships values ('00000000-0000-0000-0000-0000000000b1','admin','active')$q$), 'parent cannot make themselves admin');
select t.ok(t.denied($q$insert into public.player_guardians (player_id,user_id) values ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1')$q$), 'parent cannot link themselves to another child');
select t.ok(t.denied($q$select public.create_family_invite('20000000-0000-0000-0000-000000000001')$q$), 'parent cannot create invites');
select t.ok(t.denied($q$select public.approve_member('00000000-0000-0000-0000-0000000000e1', true)$q$), 'parent cannot approve coaches');

-- parent B2 (Ben) must not see Ana's messages or replies
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(t.count($q$select count(*) from public.records where kind in ('message','availability')$q$) = 0, 'other parent cannot see Ana''s messages or replies');
select t.ok(t.count($q$select count(*) from public.records where kind='event'$q$) = 1, 'other parent in same team still sees the event');

-- parent B3 (other team)
select t.login('00000000-0000-0000-0000-0000000000b3');
select t.ok(t.count($q$select count(*) from public.records where kind='event'$q$) = 0, 'parent of another team cannot see this team''s events');
select t.ok(t.count($q$select count(*) from public.records where kind='announcement'$q$) = 1, 'club announcements reach every team');

-- coach C1 reads parent message; coach C2 cannot
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.count($q$select count(*) from public.records where kind='message'$q$) = 1, 'coach sees parent message for own team');
insert into public.records (id,kind,team_id,player_id,visibility,data) values ('30000000-0000-0000-0000-000000000012','message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"body":"Get well soon"}');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count($q$select count(*) from public.records where kind='message'$q$) = 2, 'parent sees coach reply');
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.count($q$select count(*) from public.records where kind in ('message','assessment','assessment_pub')$q$) = 0, 'coach of another team sees nothing of this team');
select t.ok(t.count('select count(*) from public.players') = 1, 'coach C2 sees only their player');

-- pending coach and strangers
select t.login('00000000-0000-0000-0000-0000000000e1');
select t.ok(t.count('select count(*) from public.players') = 0, 'pending coach sees no players');
select t.ok(t.count('select count(*) from public.records') = 0, 'pending coach sees no records');
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.ok(t.count('select count(*) from public.players') = 0, 'signed-in stranger sees nothing');
select t.ok(t.count('select count(*) from public.records') = 0, 'signed-in stranger sees no records');
select t.ok(t.denied('select public.claim_admin()'), 'second claim_admin is refused');
reset role;
set role anon;
select t.ok(t.denied('select count(*) from public.players'), 'anon cannot read players');
select t.ok(t.denied('select count(*) from public.records'), 'anon cannot read records');
reset role;

-- invites
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.denied($q$select public.create_family_invite('20000000-0000-0000-0000-000000000001')$q$), 'coach cannot invite for a child outside their team');
select t.login('00000000-0000-0000-0000-0000000000c1');
create temp table tok (t text);
grant all on tok to authenticated;
insert into tok select public.create_family_invite('20000000-0000-0000-0000-000000000002');
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.ok(public.redeem_invite((select t from tok)) = 'Ben', 'new parent redeems a family invite');
select t.ok(t.count('select count(*) from public.players') = 1, 'new parent now sees exactly that child');
select t.ok(public.my_role() = 'parent', 'redeemer is a parent');
select t.login('00000000-0000-0000-0000-0000000000e1');
select t.ok(t.denied(format($q$select public.redeem_invite(%L)$q$, (select t from tok))), 'invite cannot be used twice');
select t.ok(t.denied($q$select public.redeem_invite('nonsense')$q$), 'bad token refused');
reset role;
update public.invites set expires_at = now() - interval '1 day';
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c1');
insert into tok select public.create_family_invite('20000000-0000-0000-0000-000000000001');
reset role;
update public.invites set expires_at = now() - interval '1 day' where used_at is null;
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b3');
select t.ok(t.denied(format($q$select public.redeem_invite(%L)$q$, (select t from tok order by t limit 1))), 'expired invite refused');
do $$ begin for i in 1..10 loop perform t.denied($q$select public.redeem_invite('x')$q$); end loop; end $$;
select t.ok(t.denied($q$select public.redeem_invite('x')$q$), 'rate limit after 10 tries');
reset role;
select name, case when ok then 'PASS' else 'FAIL' end as result from t.results order by ok, name;
select count(*) filter (where not ok) as failures, count(*) as total from t.results \gset
rollback;
\if :failures
  \echo FAILED :failures of :total
  \quit 3
\else
  \echo ALL :total ACCESS TESTS PASSED
\endif
