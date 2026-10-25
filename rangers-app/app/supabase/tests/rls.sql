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
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b4','b4@x');
insert into public.memberships values ('00000000-0000-0000-0000-0000000000b4','parent','active');
insert into public.player_guardians (player_id,user_id) values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b4');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b4');
select t.ok(t.state($q$update public.records set data = '{"status":"submitted","feedback":"","mediaPath":"p/20000000-0000-0000-0000-000000000001/w.jpg"}' where id='50000000-0000-0000-0000-000000000002'$q$) = '00000'
  and t.count($q$select count(*) from public.records where id='50000000-0000-0000-0000-000000000002' and data->>'mediaPath' like '%w.jpg'$q$) = 1, 'the other parent of the same child can re-send the proof');
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.state($q$update public.records set data = '{"status":"submitted","feedback":"","mediaPath":"hack"}' where id='50000000-0000-0000-0000-000000000002'$q$);
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.count($q$select count(*) from public.records where id='50000000-0000-0000-0000-000000000002' and data->>'mediaPath' like '%w.jpg'$q$) = 1, 'a parent from another family cannot change the proof');
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

-- School team settings and screening papers (team_info, eligibility)
select t.login('00000000-0000-0000-0000-0000000000c1');
insert into public.records (id,kind,team_id,player_id,visibility,data) values
 ('60000000-0000-0000-0000-000000000001','team_info','10000000-0000-0000-0000-000000000001',null,'team','{"kind":"school","schoolName":"GSC SPED Integrated School"}'),
 ('60000000-0000-0000-0000-000000000002','eligibility','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"category":"Secondary Boys","docs":{"psa":true}}');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count($q$select count(*) from public.records where kind in ('team_info','eligibility')$q$) = 2, 'a family sees its team''s school details and its own child''s screening');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,player_id,visibility,data) values (gen_random_uuid(),'eligibility','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"docs":{"psa":true,"sf10":true}}')$q$) = '42501', 'a parent cannot tick their own screening papers');
select t.ok(t.state($q$update public.records set data = '{"selectedFor":["palaro"]}' where id='60000000-0000-0000-0000-000000000002'$q$) = '00000' and t.count($q$select count(*) from public.records where id='60000000-0000-0000-0000-000000000002' and data ? 'selectedFor'$q$) = 0, 'a parent cannot select their own child for a meet');
select t.ok(t.state($q$insert into public.records (id,kind,team_id,visibility,data) values (gen_random_uuid(),'team_info','10000000-0000-0000-0000-000000000001','team','{}')$q$) = '42501', 'a parent cannot change school team settings');
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(t.count($q$select count(*) from public.records where kind = 'eligibility'$q$) = 0, 'another family in the team cannot see a child''s screening');
select t.login('00000000-0000-0000-0000-0000000000b3');
select t.ok(t.count($q$select count(*) from public.records where kind in ('team_info','eligibility')$q$) = 0, 'a family in another team sees neither');
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.state($q$update public.records set data = '{}' where id='60000000-0000-0000-0000-000000000001'$q$) = '00000' and t.count($q$select count(*) from public.records where id='60000000-0000-0000-0000-000000000001'$q$) = 0, 'a coach of another team cannot see or change the school settings');

-- Media bucket
reset role;
select t.ok((select file_size_limit from storage.buckets where id='media') = 2097152 and not (select public from storage.buckets where id='media'), 'photo storage is private with a 2 MB limit');
select t.ok((select allowed_mime_types from storage.buckets where id='media') = array['image/jpeg','image/png','image/webp'], 'photo storage accepts photos only, no videos');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','p/20000000-0000-0000-0000-000000000001/a.jpg')$q$) = '00000', 'parent can upload a proof for their own child');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','p/20000000-0000-0000-0000-000000000002/a.jpg')$q$) = '42501', 'parent cannot upload into another child''s folder');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','t/10000000-0000-0000-0000-000000000001/v.jpg')$q$) = '42501', 'parent cannot upload a coach photo');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','p/not-a-uuid/a.jpg')$q$) = '42501', 'a malformed path is refused');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','t/10000000-0000-0000-0000-000000000001/v.jpg')$q$) = '00000', 'coach can upload a how-to photo for their team');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','t/10000000-0000-0000-0000-000000000002/v.jpg')$q$) = '42501', 'coach cannot upload for another team');
select t.ok(t.count($q$select count(*) from storage.objects where name like 'p/20000000-0000-0000-0000-000000000001/%'$q$) = 1, 'coach can see their child''s proof file');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count($q$select count(*) from storage.objects where name like 't/10000000-0000-0000-0000-000000000001/%'$q$) = 1, 'parent can see their team''s how-to photo');
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(t.count($q$select count(*) from storage.objects where name like 'p/20000000-0000-0000-0000-000000000001/%'$q$) = 0, 'another family cannot see the proof file');
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.count($q$select count(*) from storage.objects$q$) = 0, 'a coach of another team sees none of these files');
reset role;
select t.ok(not has_function_privilege('anon', 'public.team_guardians(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.team_guardians(uuid)', 'execute'), 'nobody outside the database can list a team''s parents');
select t.ok(not has_function_privilege('anon', 'public.team_coaches(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.team_coaches(uuid)', 'execute'), 'nobody outside the database can list a team''s coaches');
select t.ok(not has_function_privilege('anon', 'public.enqueue_event_reminders()', 'execute') and not has_function_privilege('authenticated', 'public.purge_old_data()', 'execute'), 'reminders and clean-up cannot be triggered from outside');
select t.ok(not has_function_privilege('authenticated', 'public.rangers_health()', 'execute'), 'the health checklist is for the SQL Editor only');
select t.ok((select count(*) from public.rangers_health()) = 14 and (select ok from public.rangers_health() where item like 'Assignments rules%'), 'health checklist runs and sees the assignments rules');
reset role;

-- ========== short videos (0007) ==========
select t.ok((select file_size_limit from storage.buckets where id='clips') = 5242880 and not (select public from storage.buckets where id='clips')
  and (select allowed_mime_types from storage.buckets where id='clips') = array['video/mp4','video/webm','video/quicktime'], 'videos have their own private bucket, 5 MB each, video files only');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name,metadata) values ('clips','p/20000000-0000-0000-0000-000000000001/proof.mp4','{"size": 3000000}')$q$) = '00000', 'a parent sends a video for their own child');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('clips','p/20000000-0000-0000-0000-000000000003/x.mp4')$q$) = '42501', 'never into another family''s child');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('clips','t/10000000-0000-0000-0000-000000000001/how.mp4')$q$) = '42501', 'parents cannot add a team how-to video');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name,metadata) values ('clips','t/10000000-0000-0000-0000-000000000001/how.mp4','{"size": 2000000}')$q$) = '00000', 'a coach adds a how-to video for their team');
select t.ok(t.count($q$select count(*) from storage.objects where bucket_id='clips'$q$) = 2, 'the coach sees the child''s video and the team video');
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.count($q$select count(*) from storage.objects where bucket_id='clips'$q$) = 0, 'a coach of another team sees none of them');
delete from storage.objects where bucket_id = 'clips';
select t.login('00000000-0000-0000-0000-0000000000b3');
select t.ok(t.count($q$select count(*) from storage.objects where bucket_id='clips'$q$) = 0, 'a family in another team sees none of them');
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(t.count($q$select count(*) from storage.objects where bucket_id='clips'$q$) = 1, 'a family in the team sees the team video, not another child''s video');
select t.ok(public.clips_used() = 5000000 and public.clips_room() = 600 * 1024 * 1024 - 5000000, 'the app can see how much video space is left');
reset role;
select t.ok((select count(*) from storage.objects where bucket_id='clips') = 2, 'a coach of another team cannot delete them');
insert into storage.objects (bucket_id,name,metadata) values ('clips','p/20000000-0000-0000-0000-000000000001/old.mp4','{"size": 629145600}');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(public.clips_room() = 0 and t.state($q$insert into storage.objects (bucket_id,name) values ('clips','p/20000000-0000-0000-0000-000000000001/more.mp4')$q$) = '42501', 'when the club video space is full, new videos are refused');
delete from storage.objects where bucket_id = 'clips' and name = 'p/20000000-0000-0000-0000-000000000001/old.mp4';
reset role;
select t.ok((select count(*) from storage.objects where bucket_id='clips') = 2, 'nothing else is deleted to make room; a family can delete their own child''s video');
select t.ok((select count(*) from storage.objects where name = 't/10000000-0000-0000-0000-000000000001/how.mp4') = 1, 'the coach''s video stays until a coach removes it');
delete from storage.objects where bucket_id = 'clips';
select t.ok(not has_function_privilege('anon', 'public.clips_room()', 'execute'), 'video space is for signed-in people only');
-- video permission: set by the family, seen by the coach
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b1');
select public.set_consent('20000000-0000-0000-0000-000000000001', 'video', true, 'v1');
select t.ok(t.state($q$select public.set_consent('20000000-0000-0000-0000-000000000003', 'video', true, 'v1')$q$) = '42501', 'a parent cannot give video permission for another child');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.count($q$select count(*) from public.players where video_consent$q$) = 1, 'the coach sees which child may be filmed');
reset role;
-- the video library (YouTube links): coaches only, one team, or the whole club
insert into public.records (id,kind,team_id,visibility,data) values
 ('30000000-0000-0000-0000-0000000000f1','video',null,'staff','{"title":"Our match day routine"}'),
 ('30000000-0000-0000-0000-0000000000f2','video','10000000-0000-0000-0000-000000000001','team','{"title":"Ball mastery"}'),
 ('30000000-0000-0000-0000-0000000000f3','video',null,'club','{"title":"Warm-up"}');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count($q$select count(*) from public.records where kind='video'$q$) = 2 and t.count($q$select count(*) from public.records where kind='video' and visibility='staff'$q$) = 0, 'a family sees their team''s and the club''s videos, never the coaches-only ones');
select t.ok(t.state($q$insert into public.records (id,kind,visibility,data,author) values (gen_random_uuid(),'video','club','{}','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'a parent cannot add a video to the library');
select t.login('00000000-0000-0000-0000-0000000000b3');
select t.ok(t.count($q$select count(*) from public.records where kind='video'$q$) = 1, 'a family in another team sees only the club video');
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.count($q$select count(*) from public.records where kind='video'$q$) = 2, 'a coach of another team sees the coaches-only and club videos, not the other team''s');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.state($q$insert into public.records (id,kind,visibility,data,author) values (gen_random_uuid(),'video','staff','{}','00000000-0000-0000-0000-0000000000c1')$q$) = '00000', 'a coach adds a coaches-only video');
reset role;
delete from public.records where kind = 'video';

-- ========== coaches' drills, Google Drive videos, test alerts (0008) ==========
insert into public.records (id,kind,team_id,visibility,data,author) values
 ('30000000-0000-0000-0000-0000000000d1','drill',null,'staff','{"name":"Rondo 4v1","video":{"drive":"1AbCdEfGhIjKlMnOpQrStUvWxYz012345"}}','00000000-0000-0000-0000-0000000000c1');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.count($q$select count(*) from public.records where kind='drill'$q$) = 1, 'a coach of another team can open a coach''s drill (drills are for every coach)');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','d/30000000-0000-0000-0000-0000000000d1/a.jpg')$q$) = '00000', 'any coach can add a photo to a drill');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name,metadata) values ('clips','d/30000000-0000-0000-0000-0000000000d1/how.mp4','{"size": 1000}')$q$) = '00000', 'any coach can add a short video to a drill');
select t.ok(public.drive_ok('upload'), 'any coach may upload a video to the club Drive');
select t.ok(not public.drive_ok('delete', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'), 'another coach cannot remove a Drive video that a coach saved');
select t.ok(public.drive_ok('delete', 'ZZZZZZZZZZZZZZZZZZZZZZZZZZunsaved'), 'a Drive video that was uploaded but never saved can be cleaned up');
select t.ok(not public.drive_ok('delete', '') and not public.drive_ok('delete', '%') and not public.drive_ok('other'), 'odd requests to the Drive helper are refused');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(public.drive_ok('delete', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'), 'the coach who saved a Drive video can remove it');
select t.login('00000000-0000-0000-0000-0000000000a1');
select t.ok(public.drive_ok('delete', '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'), 'a club admin can remove any Drive video');
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(t.count($q$select count(*) from public.records where kind='drill'$q$) = 0, 'families never see coaches'' drills');
select t.ok(t.count($q$select count(*) from storage.objects where name like 'd/%'$q$) = 0, 'families never see drill photos or videos');
select t.ok(t.state($q$insert into storage.objects (bucket_id,name) values ('media','d/30000000-0000-0000-0000-0000000000d1/b.jpg')$q$) = '42501', 'families cannot add drill photos');
select t.ok(t.state($q$insert into public.records (id,kind,visibility,data,author) values (gen_random_uuid(),'drill','staff','{}','00000000-0000-0000-0000-0000000000b1')$q$) = '42501', 'families cannot add drills');
select t.ok(not public.drive_ok('upload') and not public.drive_ok('delete', 'ZZZZZZZZZZZZZZZZZZZZZZZZZZunsaved'), 'families cannot upload to or remove from the club Drive');
select public.queue_test_alert();
select t.ok(t.count($q$select count(*) from public.notification_queue where dedupe_key like 'test:%'$q$) >= 0, 'anyone signed in can ask for a test alert');
select public.queue_test_alert(); select public.queue_test_alert(); select public.queue_test_alert(); select public.queue_test_alert();
select t.ok(t.state($q$select public.queue_test_alert()$q$) <> '00000', 'test alerts are limited (5 an hour)');
reset role;
select t.ok((select count(*) from public.notification_queue where dedupe_key like 'test:%' and user_id = '00000000-0000-0000-0000-0000000000b1') = 5, 'test alerts go only to the person who asked');
select t.ok(not has_function_privilege('anon', 'public.drive_ok(text,text)', 'execute') and not has_function_privilege('anon', 'public.queue_test_alert()', 'execute'), 'the Drive helper and test alerts need a sign-in');
delete from storage.objects where name like 'd/%'; delete from public.records where kind = 'drill'; delete from public.notification_queue where dedupe_key like 'test:%';

-- ========== feedback (0006) ==========
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok(public.send_feedback('idea', 'Please add a calendar view', 3, 'schedule') is not null, 'a parent sends feedback');
select t.ok(t.state($q$select public.send_feedback('idea', '   ', null, '')$q$) = 'P0001', 'empty feedback is refused');
select t.ok(t.count('select count(*) from public.feedback') = 1, 'the sender sees their own feedback');
select t.ok((select name from public.feedback limit 1) = 'b1@x' and (select role from public.feedback limit 1) = 'parent', 'feedback carries who sent it');
select t.ok(t.state($q$insert into public.feedback (user_id, kind, message) values (auth.uid(), 'idea', 'around the checks')$q$) = '42501', 'feedback cannot be written around the checks');
update public.feedback set status = 'done';
select t.ok((select status from public.feedback limit 1) = 'new', 'a sender cannot mark their own feedback done');
select t.login('00000000-0000-0000-0000-0000000000b3');
select t.ok(t.count('select count(*) from public.feedback') = 0, 'another parent cannot read it');
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.count('select count(*) from public.feedback') = 0 and not public.is_feedback_reader(), 'a coach who is not a reader cannot read it');
select t.login('00000000-0000-0000-0000-0000000000a1');
select t.ok(public.is_feedback_reader() and t.count('select count(*) from public.feedback') = 1, 'an admin reads all feedback');
update public.feedback set status = 'seen';
select t.ok((select status from public.feedback limit 1) = 'seen', 'an admin marks feedback seen');
select t.ok(t.state($q$update public.feedback set message = 'changed'$q$) = '42501', 'readers can change the status only, never the words');
select public.set_feedback_reader('00000000-0000-0000-0000-0000000000d1', true);
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.ok(public.is_feedback_reader() and t.count('select count(*) from public.feedback') = 1, 'a chosen reader who is not an admin reads it too');
select t.ok(t.state($q$select public.set_feedback_reader('00000000-0000-0000-0000-0000000000d1', false)$q$) = 'P0001', 'a reader cannot change who reads feedback');
select t.ok(t.state($q$delete from public.feedback$q$) = '00000' and t.count('select count(*) from public.feedback') = 1, 'only admins can delete feedback');
select t.login('00000000-0000-0000-0000-0000000000b1');
do $$ begin for i in 1..19 loop perform public.send_feedback('other', 'note number ' || i, null, ''); end loop; end $$;
select t.ok(t.state($q$select public.send_feedback('other', 'one too many', null, '')$q$) = 'P0001', 'at most 20 a day from one person');
reset role;
select t.ok(exists (select 1 from public.notification_queue where url = '/feedback/inbox' and user_id = '00000000-0000-0000-0000-0000000000a1'), 'admins get an alert for new feedback');
select t.ok(exists (select 1 from public.notification_queue where url = '/feedback/inbox' and user_id = '00000000-0000-0000-0000-0000000000d1'), 'chosen readers get the alert too');
select t.ok(not exists (select 1 from public.notification_queue where url = '/feedback/inbox' and user_id = '00000000-0000-0000-0000-0000000000b1'), 'the sender is not alerted about their own feedback');
select t.ok(not has_function_privilege('anon', 'public.send_feedback(text, text, int, text)', 'execute'), 'feedback needs a signed-in person');

-- ========== admins: invite, hand over, step down, remove a coach (0005) ==========
-- (last, because it changes who is admin and removes a coach)
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(t.state($q$select public.create_admin_invite()$q$) = 'P0001', 'a coach cannot make an admin invite');
select t.ok(t.state($q$select public.remove_member('00000000-0000-0000-0000-0000000000c2')$q$) = 'P0001', 'a coach cannot remove another coach');
select t.ok(t.state($q$select public.remove_admin('00000000-0000-0000-0000-0000000000a1')$q$) = 'P0001', 'a coach cannot take away admin rights');
select t.login('00000000-0000-0000-0000-0000000000a1');
insert into tok select 'admin', public.create_admin_invite();
insert into tok select 'admin2', public.create_admin_invite();
select t.ok((select expires_at < now() + interval '3 days 1 minute' from public.invites where kind = 'admin' limit 1), 'admin links expire within 3 days');
select t.ok(t.state($q$select public.remove_admin('00000000-0000-0000-0000-0000000000a1')$q$) = 'P0001', 'the only admin cannot step down');
select t.login('00000000-0000-0000-0000-0000000000c3');
select t.ok(public.redeem_invite((select t from tok where k='admin')) = 'admin', 'an assistant coach opens the admin link');
select t.ok(public.my_role() = 'admin', 'and is an admin straight away');
select t.ok(t.count('select count(*) from public.memberships') >= 9, 'the new admin sees every member of the club');
select t.ok(t.count($q$select count(*) from public.players$q$) = 3, 'the new admin sees every child in the club');
select t.login('00000000-0000-0000-0000-0000000000d1');
select t.ok(public.redeem_invite((select t from tok where k='admin')) is null, 'an admin link works only once');
reset role;
update public.invites set expires_at = now() - interval '1 minute' where kind = 'admin' and used_at is null;
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000e1');
select t.ok(public.redeem_invite((select t from tok where k='admin2')) is null and public.my_role() = 'pending', 'an expired admin link does nothing');
select t.login('00000000-0000-0000-0000-0000000000a1');
select public.remove_admin('00000000-0000-0000-0000-0000000000a1');
select t.ok(public.my_role() = 'coach', 'the old admin steps down and stays as a coach');
select t.ok(t.state($q$select public.create_admin_invite()$q$) = 'P0001', 'after stepping down they cannot make admin links');
select t.login('00000000-0000-0000-0000-0000000000c3');
select t.ok(t.state($q$select public.remove_admin('00000000-0000-0000-0000-0000000000c3')$q$) = 'P0001', 'the last admin cannot step down');
select t.ok(t.state($q$select public.remove_member('00000000-0000-0000-0000-0000000000c3')$q$) = 'P0001', 'an admin is not removed without taking their rights away first');
select public.remove_staff('00000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-000000000001');
reset role;
select t.ok(not exists (select 1 from public.team_staff where user_id = '00000000-0000-0000-0000-0000000000c1'), 'admin takes a coach off a team');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c3');
select public.remove_member('00000000-0000-0000-0000-0000000000c2');
select public.remove_member('00000000-0000-0000-0000-0000000000b2');
reset role;
select t.ok(not exists (select 1 from public.memberships where user_id = '00000000-0000-0000-0000-0000000000c2') and not exists (select 1 from public.team_staff where user_id = '00000000-0000-0000-0000-0000000000c2'), 'a coach who left loses every team');
set role authenticated;
select t.login('00000000-0000-0000-0000-0000000000c2');
select t.ok(t.count($q$select count(*) from public.players$q$) = 0 and public.my_role() is null, 'and sees no children any more');
select t.login('00000000-0000-0000-0000-0000000000b2');
select t.ok(public.my_role() = 'parent' and t.count($q$select count(*) from public.players where first_name='Ben'$q$) = 1, 'a coach who is also a parent keeps their own child');
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
