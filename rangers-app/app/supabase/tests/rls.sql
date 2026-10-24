-- Access-rule tests. Each refusal is checked for the RIGHT reason:
--   42501 = blocked by a security rule (RLS or an explicit permission check), P0001 = refused by an RPC.
begin;
create schema if not exists t;
create table if not exists t.results (name text, ok boolean);
create or replace function t.ok(c boolean, name text) returns void language plpgsql as $$ begin insert into t.results values (name, coalesce(c, false)); end $$;
create or replace function t.login(u uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); end $$;
create or replace function t.count(q text) returns bigint language plpgsql as $$ declare n bigint; begin execute q into n; return n; end $$;
-- Runs q and returns its SQLSTATE ('00000' when it succeeded).
create or replace function t.state(q text) returns text language plpgsql as $$ begin
  begin execute q; exception when others then return sqlstate; end; return '00000'; end $$;
create or replace function t.val(q text) returns text language plpgsql as $$ declare v text; begin execute q into v; return v; end $$;
grant usage on schema t to authenticated, anon;
grant all on all tables in schema t to authenticated, anon;
grant execute on all functions in schema t to authenticated, anon;

-- ids: a1 admin, c1 coach U10 (head), c2 coach U12, c3 assistant U10, b1/b2 parents U10, b3 parent U12, d1 stranger, e1 pending coach
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1','admin@x'), ('00000000-0000-0000-0000-0000000000c1','c1@x'), ('00000000-0000-0000-0000-0000000000c2','c2@x'),
 ('00000000-0000-0000-0000-0000000000c3','c3@x'), ('00000000-0000-0000-0000-0000000000b1','b1@x'), ('00000000-0000-0000-0000-0000000000b2','b2@x'),
 ('00000000-0000-0000-0000-0000000000b3','b3@x'), ('00000000-0000-0000-0000-0000000000d1','d1@x'), ('00000000-0000-0000-0000-0000000000e1','e1@x');
insert into public.memberships values
 ('00000000-0000-0000-0000-0000000000a1','admin','active'), ('00000000-0000-0000-0000-0000000000c1','coach','active'),
 ('00000000-0000-0000-0000-0000000000c2','coach','active'), ('00000000-0000-0000-0000-0000000000c3','coach','active'),
 ('00000000-0000-0000-0000-0000000000b1','parent','active'), ('00000000-0000-0000-0000-0000000000b2','parent','active'),
 ('00000000-0000-0000-0000-0000000000b3','parent','active'), ('00000000-0000-0000-0000-0000000000e1','coach','pending');
insert into public.teams (id,name,programme,age_band) values
 ('10000000-0000-0000-0000-000000000001','Rangers U10','rangers','U10'), ('10000000-0000-0000-0000-000000000002','Gila U12','gila','U12');
insert into public.team_staff values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1',true),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c3',false),
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
-- ========== coach C1 ==========
select t.login('00000000-0000-0000-0000-0000000000c1');
insert into public.records (id,kind,team_id,player_id,visibility,data) values
 ('30000000-0000-0000-0000-000000000001','assessment_pub','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"strength":"touch"}'),
 ('30000000-0000-0000-0000-000000000002','assessment','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','coach','{"coachNote":"private"}'),
 ('30000000-0000-0000-0000-000000000003','event','10000000-0000-0000-0000-000000000001',null,'team','{"title":"Training"}'),
 ('30000000-0000-0000-0000-000000000004','announcement',null,null,'club','{"title":"Club news"}'),
 ('30000000-0000-0000-0000-000000000005','strategy',null,null,'staff','{"coachNote":"their left back is slow"}'),
 ('30000000-0000-0000-0000-000000000006','injury','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','family','{"head":true}');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,visibility,data) values (gen_random_uuid(),'event','10000000-0000-0000-0000-000000000002','team','{}')$q$) = '42501', 'coach cannot write to another team');
select t.ok(t.state($q$insert into public.records (id,kind,visibility,data) values ('40000000-0000-0000-0000-000000000001','settings','club','{"gcashNumber":"0999"}')$q$) = '42501', 'a coach cannot set club settings (GCash number)');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,visibility,data,author) values (gen_random_uuid(),'event','10000000-0000-0000-0000-000000000001','team','{}','00000000-0000-0000-0000-0000000000c3')$q$) = '42501', 'coach cannot write as another coach');
select t.ok(t.count('select count(*) from public.players') = 2, 'coach sees only their 2 players');
select t.ok(t.count('select count(*) from public.player_private') = 2, 'coach sees private info of their players');
select t.ok(t.count('select count(*) from public.records') = 6, 'coach sees all records of their team');

-- ========== assistant coach C3 cannot clear a head injury; head coach C1 can ==========
select t.login('00000000-0000-0000-0000-0000000000c3');
select t.ok(t.state($q$update public.records set data = data || '{"clearedOn":"2026-11-01"}' where id = '30000000-0000-0000-0000-000000000006'$q$) = '42501', 'assistant coach cannot clear a head injury');
select t.ok(t.state($q$update public.records set deleted_at = now() where id = '30000000-0000-0000-0000-000000000006'$q$) = '42501', 'assistant coach cannot delete a head injury');
select t.ok(t.state($q$update public.records set data = '{"head":false}' where id = '30000000-0000-0000-0000-000000000006'$q$) = '42501', 'assistant coach cannot un-mark a head injury');
select t.ok(t.state($q$update public.records set data = data || '{"notes":"ice applied"}' where id = '30000000-0000-0000-0000-000000000006'$q$) = '00000', 'assistant coach can still add notes to the injury');
select t.ok(t.count('select count(*) from public.records where kind = ''strategy''') = 1, 'any coach sees saved moves (staff)');

-- ========== parent B1 (child Ana) ==========
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count('select count(*) from public.players') = 1, 'parent sees only own child');
select t.ok(t.count($q$select count(*) from public.players where first_name='Ben'$q$) = 0, 'parent cannot see another family''s child');
select t.ok(t.count('select count(*) from public.player_private') = 1, 'parent sees own child private info only');
select t.ok(t.count($q$select count(*) from public.records where kind='assessment_pub'$q$) = 1, 'parent sees published review of own child');
select t.ok(t.count($q$select count(*) from public.records where kind='assessment'$q$) = 0, 'parent cannot see coach-only notes');
select t.ok(t.count($q$select count(*) from public.records where kind='strategy'$q$) = 0, 'parent cannot see coaches'' saved moves and notes');
select t.ok(t.count($q$select count(*) from public.records where kind='injury'$q$) = 0, 'parent cannot see another child''s injury');
select t.ok(t.count($q$select count(*) from public.records where kind='event'$q$) = 1, 'parent sees team event');
select t.ok(t.count($q$select count(*) from public.records where kind='announcement'$q$) = 1, 'parent sees club announcement');
insert into public.records (id,kind,team_id,player_id,visibility,data,author) values
 ('30000000-0000-0000-0000-000000000010','availability','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"status":"going"}','00000000-0000-0000-0000-0000000000b1'),
 ('30000000-0000-0000-0000-000000000011','message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"from":"parent","body":"Ana is sick today"}','00000000-0000-0000-0000-0000000000b1'),
 ('30000000-0000-0000-0000-000000000013','seen','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"ref":"x"}','00000000-0000-0000-0000-0000000000b1');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"from":"coach","body":"No training"}','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'parent cannot post a message pretending to be the coach');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'availability','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','family','{}','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'parent cannot reply for another family''s child');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,visibility,data,author) values (gen_random_uuid(),'event','10000000-0000-0000-0000-000000000001','team','{}','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'parent cannot create events');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'charge','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"status":"paid"}','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'parent cannot create or mark charges');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'availability','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','family','{}','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'parent cannot point a reply at another team');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data,author) values (gen_random_uuid(),'message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"from":"parent"}','00000000-0000-0000-0000-0000000000c1')$q$) = '42501', 'parent cannot post as someone else');
select t.ok(t.state($q$insert into public.records (id,kind,visibility,data,author) values (gen_random_uuid(),'settings','club','{}','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'parent cannot change club settings');
update public.records set data = '{"title":"hacked"}' where id = '30000000-0000-0000-0000-000000000003';
select t.ok(t.count($q$select count(*) from public.records where data->>'title' = 'hacked'$q$) = 0, 'parent cannot edit coach records');
update public.records set data = '{"status":"no"}' where id = '30000000-0000-0000-0000-000000000010';
select t.ok(t.val($q$select data->>'status' from public.records where id = '30000000-0000-0000-0000-000000000010'$q$) = 'no', 'parent can change their own reply');
select t.ok(t.state($q$insert into public.memberships values ('00000000-0000-0000-0000-0000000000b1','admin','active')$q$) = '42501', 'parent cannot make themselves admin');
select t.ok(t.state($q$insert into public.player_guardians (player_id,user_id) values ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'parent cannot link themselves to another child');
select t.ok(t.state($q$select public.create_family_invite('20000000-0000-0000-0000-000000000001')$q$) = 'P0001', 'parent cannot create invites');
select t.ok(t.state($q$select public.approve_member('00000000-0000-0000-0000-0000000000e1', true)$q$) = 'P0001', 'parent cannot approve coaches');
select t.ok(t.state($q$update public.players set first_name = 'X' where id = '20000000-0000-0000-0000-000000000001'$q$) = '00000' and t.count($q$select count(*) from public.players where first_name='X'$q$) = 0, 'parent cannot edit the player record directly');
select public.set_consent('20000000-0000-0000-0000-000000000001', 'photo', true, 'v1');
select t.ok(t.count($q$select count(*) from public.players where photo_consent$q$) = 1, 'parent photo consent updates the coach-visible flag');
select t.ok(t.count('select count(*) from public.consents') = 1, 'consent is recorded with its notice version');
select t.ok(t.state($q$select public.set_consent('20000000-0000-0000-0000-000000000002', 'photo', true, 'v1')$q$) = '42501', 'parent cannot consent for another child');
update public.player_private set data = '{"allergies":"nuts, eggs"}' where player_id = '20000000-0000-0000-0000-000000000001';
select t.ok(t.val($q$select data->>'allergies' from public.player_private where player_id = '20000000-0000-0000-0000-000000000001'$q$) = 'nuts, eggs', 'parent can update their own child''s emergency info');
select t.ok(t.state('select public.purge_old_data()') = '42501', 'parent cannot run the retention job');

-- ========== other parents and coaches ==========
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(t.count($q$select count(*) from public.records where kind in ('message','availability')$q$) = 0, 'other parent cannot see Ana''s messages or replies');
select t.ok(t.count($q$select count(*) from public.records where kind='event'$q$) = 1, 'other parent in same team still sees the event');
select t.ok(t.count($q$select count(*) from public.records where kind='injury'$q$) = 1, 'parent sees their own child''s injury');
select t.login('00000000-0000-0000-0000-0000000000b3');
select t.ok(t.count($q$select count(*) from public.records where kind='event'$q$) = 0, 'parent of another team cannot see this team''s events');
select t.ok(t.count($q$select count(*) from public.records where kind='announcement'$q$) = 1, 'club announcements reach every team');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.count($q$select count(*) from public.records where kind='message'$q$) = 1, 'coach sees parent message for own team');
insert into public.records (id,kind,team_id,player_id,visibility,data) values ('30000000-0000-0000-0000-000000000012','message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"from":"coach","body":"Get well soon"}');
update public.records set data = data || '{"clearedOn":"2026-11-20"}' where id = '30000000-0000-0000-0000-000000000006';
select t.ok(t.val($q$select data->>'clearedOn' from public.records where id = '30000000-0000-0000-0000-000000000006'$q$) = '2026-11-20', 'head coach can clear a head injury');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count($q$select count(*) from public.records where kind='message'$q$) = 2, 'parent sees coach reply');
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.count($q$select count(*) from public.records where kind in ('message','assessment','assessment_pub','injury')$q$) = 0, 'coach of another team sees nothing of this team');
select t.ok(t.count('select count(*) from public.players') = 1, 'coach C2 sees only their player');
select t.login('00000000-0000-0000-0000-0000000000a1');
insert into public.records (id,kind,visibility,data) values ('40000000-0000-0000-0000-000000000002','settings','club','{"gcashNumber":"0917"}');
select t.ok(t.count($q$select count(*) from public.records where kind='settings'$q$) = 1, 'admin can set club settings');
select t.ok(t.count('select count(*) from public.audit_log') > 0, 'admin can read the audit log of sensitive changes');

-- ========== pending coach, stranger, anon ==========
select t.login('00000000-0000-0000-0000-0000000000e1');
select t.ok(t.count('select count(*) from public.players') = 0, 'pending coach sees no players');
select t.ok(t.count('select count(*) from public.records') = 0, 'pending coach sees no records');
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.ok(t.count('select count(*) from public.players') = 0, 'signed-in stranger sees nothing');
select t.ok(t.count('select count(*) from public.records') = 0, 'signed-in stranger sees no records');
select t.ok(t.state('select public.claim_admin()') = 'P0001', 'second claim_admin is refused');
select t.ok(t.count('select count(*) from public.audit_log') = 0, 'non-admin cannot read the audit log');
reset role;
set role anon;
select t.ok(t.state('select count(*) from public.players') = '42501', 'anon cannot read players');
select t.ok(t.state('select count(*) from public.records') = '42501', 'anon cannot read records');
select t.ok(t.state('select public.ping()') = '00000', 'anon can call ping (keep-alive)');
select t.ok(t.state('select public.my_role()') = '42501', 'anon cannot call other functions');
reset role;

-- ========== invites ==========
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.state($q$select public.create_family_invite('20000000-0000-0000-0000-000000000001')$q$) = 'P0001', 'coach cannot invite for a child outside their team');
select t.login('00000000-0000-0000-0000-0000000000c1');
create temp table tok (k text, t text);
grant all on tok to authenticated;
insert into tok select 'ben', public.create_family_invite('20000000-0000-0000-0000-000000000002');
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.ok(public.redeem_invite((select t from tok where k='ben')) = 'Ben', 'new parent redeems a family invite');
select t.ok(t.count('select count(*) from public.players') = 1, 'new parent now sees exactly that child');
select t.ok(public.my_role() = 'parent', 'redeemer is a parent');
select t.ok(t.count('select count(*) from public.profiles where id = auth.uid()') = 1, 'redeemer gets a profile name for the admin list');
select t.login('00000000-0000-0000-0000-0000000000e1');
select t.ok(public.redeem_invite((select t from tok where k='ben')) is null, 'invite cannot be used twice');
select t.ok(public.redeem_invite('nonsense') is null, 'bad token refused');
reset role;
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c1');
insert into tok select 'ana', public.create_family_invite('20000000-0000-0000-0000-000000000001');
reset role;
update public.invites set expires_at = now() - interval '1 day' where used_at is null;
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b3');
select t.ok(public.redeem_invite((select t from tok where k='ana')) is null, 'expired invite refused');
do $$ begin for i in 1..9 loop perform public.redeem_invite('x' || i); end loop; end $$;  -- 1 expired try above + 9 = 10
select t.ok(t.state($q$select public.redeem_invite('y')$q$) = 'P0001', 'rate limit kicks in after 10 failed tries');
-- a parent who becomes a coach is upgraded, pending approval
select t.login('00000000-0000-0000-0000-0000000000a1');
insert into tok select 'coach', public.create_coach_invite();
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(public.redeem_invite((select t from tok where k='coach')) = 'coach', 'parent redeems a coach invite');
select t.ok(public.my_role() = 'pending', 'parent becoming coach waits for approval');
select t.login('00000000-0000-0000-0000-0000000000a1');
select public.approve_member('00000000-0000-0000-0000-0000000000b2', true);
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(public.my_role() = 'coach', 'after approval they are a coach');
select t.ok(t.count($q$select count(*) from public.players where first_name='Ben'$q$) = 1, 'and still see their own child');
reset role;

-- ========== assignments and proofs (0003) ==========
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c1');
insert into public.records (id,kind,team_id,player_id,visibility,data) values
 ('50000000-0000-0000-0000-000000000001','assignment','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"title":"Ball mastery","tasks":[{"id":"t1","text":"50 toe taps"}]}');
select t.ok(t.count($q$select count(*) from public.records where kind='assignment'$q$) = 1, 'coach can assign work to their own child');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data) values (gen_random_uuid(),'assignment','10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','family','{}')$q$) = '42501', 'coach cannot assign work in another team');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count($q$select count(*) from public.records where kind='assignment'$q$) = 1, 'the child''s parent sees the assignment');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data) values (gen_random_uuid(),'assignment','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{}')$q$) = '42501', 'a parent cannot create assignments');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data) values ('50000000-0000-0000-0000-000000000002','submission','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"status":"submitted","feedback":"","mediaPath":"p/20000000-0000-0000-0000-000000000001/x.jpg"}')$q$) = '00000', 'a parent can send a proof for their own child');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data) values (gen_random_uuid(),'submission','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','family','{"status":"submitted","feedback":""}')$q$) = '42501', 'a parent cannot send a proof for someone else''s child');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data) values (gen_random_uuid(),'submission','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"status":"approved","feedback":""}')$q$) = '42501', 'a parent cannot send a proof already marked approved');
select t.ok(t.state($q$update public.records set data = '{"status":"approved","feedback":"","mediaPath":"p/20000000-0000-0000-0000-000000000001/x.jpg"}' where id='50000000-0000-0000-0000-000000000002'$q$) = '42501', 'a parent cannot approve their own proof');
select t.ok(t.state($q$update public.records set data = '{"status":"submitted","feedback":"","mediaPath":"p/20000000-0000-0000-0000-000000000001/y.jpg"}' where id='50000000-0000-0000-0000-000000000002'$q$) = '00000', 'a parent can replace their own proof');
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(t.count($q$select count(*) from public.records where kind in ('assignment','submission')$q$) = 0, 'another family sees no assignments or proofs');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.count($q$select count(*) from public.records where kind='submission'$q$) = 1, 'the coach sees the proof');
select t.ok(t.state($q$update public.records set data = '{"status":"redo","feedback":"Try again, slower","mediaPath":"p/20000000-0000-0000-0000-000000000001/y.jpg"}' where id='50000000-0000-0000-0000-000000000002'$q$) = '00000', 'the coach can ask for a redo with feedback');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.state($q$update public.records set data = '{"status":"submitted","feedback":"","mediaPath":"p/20000000-0000-0000-0000-000000000001/z.jpg"}' where id='50000000-0000-0000-0000-000000000002'$q$) = '00000', 'after a redo request the parent can send a new proof');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.state($q$update public.records set data = '{"status":"approved","feedback":"Great","mediaPath":"p/20000000-0000-0000-0000-000000000001/z.jpg"}' where id='50000000-0000-0000-0000-000000000002'$q$) = '00000', 'the coach can approve');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.state($q$update public.records set data = '{"status":"submitted","feedback":"","mediaPath":"p/20000000-0000-0000-0000-000000000001/q.jpg"}' where id='50000000-0000-0000-0000-000000000002'$q$) = '00000' and t.count($q$select count(*) from public.records where id='50000000-0000-0000-0000-000000000002' and data->>'status'='approved'$q$) = 1, 'a parent cannot change a proof the coach already approved');

-- Media bucket
reset role;
select t.ok((select file_size_limit from storage.buckets where id='media') = 41943040 and not (select public from storage.buckets where id='media'), 'media bucket is private with a 40 MB limit');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','p/20000000-0000-0000-0000-000000000001/a.jpg')$q$) = '00000', 'parent can upload a proof for their own child');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','p/20000000-0000-0000-0000-000000000002/a.jpg')$q$) = '42501', 'parent cannot upload into another child''s folder');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','t/10000000-0000-0000-0000-000000000001/v.mp4')$q$) = '42501', 'parent cannot upload a coach video');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','p/not-a-uuid/a.jpg')$q$) = '42501', 'a malformed path is refused');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','t/10000000-0000-0000-0000-000000000001/v.mp4')$q$) = '00000', 'coach can upload an instruction video for their team');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','t/10000000-0000-0000-0000-000000000002/v.mp4')$q$) = '42501', 'coach cannot upload for another team');
select t.ok(t.count($q$select count(*) from storage.objects where name like 'p/20000000-0000-0000-0000-000000000001/%'$q$) = 1, 'coach can see their child''s proof file');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count($q$select count(*) from storage.objects where name like 't/10000000-0000-0000-0000-000000000001/%'$q$) = 1, 'parent can watch their team''s instruction video');
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(t.count($q$select count(*) from storage.objects where name like 'p/20000000-0000-0000-0000-000000000001/%'$q$) = 0, 'another family cannot see the proof file');
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.count($q$select count(*) from storage.objects$q$) = 0, 'a coach of another team sees none of these files');
reset role;

select name, case when ok then 'PASS' else 'FAIL' end as result from t.results order by ok, name;
select count(*) filter (where not ok) > 0 as failed, count(*) filter (where not ok) as failures, count(*) as total from t.results \gset
rollback;
\if :failed
  \echo FAILED :failures of :total
  do $$ begin raise exception 'database tests failed'; end $$;
\else
  \echo ALL :total ACCESS TESTS PASSED
\endif
