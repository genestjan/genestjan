begin;
create schema if not exists t;
create table if not exists t.results (name text, ok boolean);
create or replace function t.ok(c boolean, name text) returns void language plpgsql as $$ begin insert into t.results values (name, coalesce(c,false)); end $$;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000b2');
insert into public.memberships values ('00000000-0000-0000-0000-0000000000c1','coach','active'),('00000000-0000-0000-0000-0000000000b1','parent','active'),('00000000-0000-0000-0000-0000000000b2','parent','active');
insert into public.teams (id,name,programme,age_band) values ('10000000-0000-0000-0000-000000000001','A','rangers','U10'),('10000000-0000-0000-0000-000000000002','B','gila','U12');
insert into public.team_staff values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1',true);
insert into public.players (id,team_id,first_name) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Ana'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Carlo');
insert into public.player_guardians values ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','parent'),('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b2','parent');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1', true);
insert into public.records (id,kind,team_id,visibility,data) values ('30000000-0000-0000-0000-000000000001','announcement','10000000-0000-0000-0000-000000000001','team','{"title":"No training Sat","body":"Rain"}');
select t.ok((select count(*) from public.notification_queue where user_id='00000000-0000-0000-0000-0000000000b1') = 1, 'team announcement notifies that team''s parent');
select t.ok((select count(*) from public.notification_queue where user_id='00000000-0000-0000-0000-0000000000b2') = 0, 'other team''s parent is not notified');
insert into public.records (id,kind,team_id,player_id,visibility,data) values ('30000000-0000-0000-0000-000000000002','message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"from":"coach","body":"Ana did great"}');
select t.ok((select count(*) from public.notification_queue where user_id='00000000-0000-0000-0000-0000000000b1' and title='Message from your coach') = 1, 'coach message notifies the child''s parent');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b1', true);
insert into public.records (id,kind,team_id,player_id,visibility,data,author) values ('30000000-0000-0000-0000-000000000003','message','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','family','{"from":"parent","body":"Thanks"}','00000000-0000-0000-0000-0000000000b1');
select t.ok((select count(*) from public.notification_queue where user_id='00000000-0000-0000-0000-0000000000c1') = 1, 'parent message notifies the team coach');
insert into public.records (id,kind,team_id,visibility,data,author) values ('30000000-0000-0000-0000-000000000004','event','10000000-0000-0000-0000-000000000001','team', json_build_object('title','Training','venue','Yam 1','startsAt', (now() + interval '24 hours')::text)::jsonb, '00000000-0000-0000-0000-0000000000c1');
insert into public.records (id,kind,team_id,visibility,data,author) values ('30000000-0000-0000-0000-000000000005','event','10000000-0000-0000-0000-000000000001','team', json_build_object('title','Far away','startsAt', (now() + interval '10 days')::text)::jsonb, '00000000-0000-0000-0000-0000000000c1');
select t.ok(public.enqueue_event_reminders() = 1, 'one reminder for the event 24h away');
select t.ok(public.enqueue_event_reminders() = 0, 'reminders are not duplicated');
select t.ok((select count(*) from public.notification_queue where title like 'Tomorrow:%') = 1, 'far-away event gets no reminder');
select name, case when ok then 'PASS' else 'FAIL' end from t.results order by ok, name;
select count(*) filter (where not ok) > 0 as failed, count(*) filter (where not ok) as failures, count(*) as total from t.results \gset
rollback;
\if :failed
  \echo NOTIFY FAILED :failures of :total
  do $$ begin raise exception 'database tests failed'; end $$;
\else
  \echo ALL :total NOTIFICATION TESTS PASSED
\endif
