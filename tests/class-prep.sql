-- 격리된 빈 PostgreSQL에서만 실행한다(운영 DB 금지): psql -v ON_ERROR_STOP=1 -f tests/class-prep.sql
-- School_Timer 저장 형식(storageV2Codec)대로 시간표를 넣고, 다시 조립한 값과 권한을 확인한 뒤 모두 되돌린다.
\set ON_ERROR_STOP 1
-- 준비(역할·빈 표)와 마이그레이션은 이 격리 DB에 남고, 넣은 시간표는 끝에서 되돌린다.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create table if not exists public.storage_resources(resource_key text primary key,category text not null,owner_number integer,value jsonb not null,deleted boolean not null default false);
grant select on public.storage_resources to service_role;
\ir ../supabase/migrations/20261018000000_gugudan_class_prep.sql
begin;
insert into public.storage_resources(resource_key,category,value,deleted) values
 ('/weeklySchedule','weeklySchedule','{"kind":"object","parentKey":"","member":"weeklySchedule"}',false),
 ('/weeklySchedule/1','weeklySchedule','{"kind":"array","parentKey":"/weeklySchedule","member":"1"}',false),
 ('/weeklySchedule/1/@c2','weeklySchedule','{"kind":"value","parentKey":"/weeklySchedule/1","member":"@c2","order":2,"data":{"id":"c2","name":"2교시","type":"class","start":590,"end":630}}',false),
 ('/weeklySchedule/1/@c1','weeklySchedule','{"kind":"value","parentKey":"/weeklySchedule/1","member":"@c1","order":0,"data":{"id":"c1","name":"1교시","type":"class","start":540,"end":580}}',false),
 ('/weeklySchedule/1/@b1','weeklySchedule','{"kind":"value","parentKey":"/weeklySchedule/1","member":"@b1","order":1,"data":{"id":"b1","name":"쉬는 시간","type":"break","start":580,"end":590}}',false),
 ('/weeklySchedule/1/@gone','weeklySchedule','{"kind":"value","parentKey":"/weeklySchedule/1","member":"@gone","order":3,"data":{"id":"gone"}}',true),
 ('/weeklySchedule/2','weeklySchedule','{"kind":"array","parentKey":"/weeklySchedule","member":"2"}',false),
 ('/weeklySubjects','weeklySubjects','{"kind":"object","parentKey":"","member":"weeklySubjects"}',false),
 ('/weeklySubjects/'||to_char(date_trunc('week',now() at time zone 'Asia/Seoul'),'YYYY-MM-DD'),'weeklySubjects',jsonb_build_object('kind','object','parentKey','/weeklySubjects','member',to_char(date_trunc('week',now() at time zone 'Asia/Seoul'),'YYYY-MM-DD')),false),
 ('/weeklySubjects/'||to_char(date_trunc('week',now() at time zone 'Asia/Seoul'),'YYYY-MM-DD')||'/1','weeklySubjects',jsonb_build_object('kind','object','parentKey','/weeklySubjects/'||to_char(date_trunc('week',now() at time zone 'Asia/Seoul'),'YYYY-MM-DD'),'member','1'),false),
 ('/weeklySubjects/'||to_char(date_trunc('week',now() at time zone 'Asia/Seoul'),'YYYY-MM-DD')||'/1/2','weeklySubjects',jsonb_build_object('kind','value','parentKey','/weeklySubjects/'||to_char(date_trunc('week',now() at time zone 'Asia/Seoul'),'YYYY-MM-DD')||'/1','member','2','data','수학'),false),
 ('/weeklySubjects/2026-01-05','weeklySubjects','{"kind":"object","parentKey":"/weeklySubjects","member":"2026-01-05"}',false),
 ('/weeklySubjects/2026-01-05/1','weeklySubjects','{"kind":"object","parentKey":"/weeklySubjects/2026-01-05","member":"1"}',false),
 ('/weeklySubjects/2026-01-05/1/2','weeklySubjects','{"kind":"value","parentKey":"/weeklySubjects/2026-01-05/1","member":"2","data":"과학"}',false),
 ('/scheduleClockOffsetSeconds','scheduleClockOffsetSeconds','{"kind":"value","parentKey":"","member":"scheduleClockOffsetSeconds","data":12}',false),
 ('/classPrepRelease','classPrepRelease','{"kind":"object","parentKey":"","member":"classPrepRelease"}',false),
 ('/classPrepRelease/dateKey','classPrepRelease','{"kind":"value","parentKey":"/classPrepRelease","member":"dateKey","data":"2026-10-19"}',false),
 ('/classPrepRelease/slotId','classPrepRelease','{"kind":"value","parentKey":"/classPrepRelease","member":"slotId","data":"c2"}',false);
set local role service_role;
do $$
declare got jsonb:=public.gugudan_class_prep(); week text:=to_char(date_trunc('week',now() at time zone 'Asia/Seoul'),'YYYY-MM-DD');
begin
  if got->'weeklySchedule'<>'{"1":[{"id":"c1","name":"1교시","type":"class","start":540,"end":580},{"id":"b1","name":"쉬는 시간","type":"break","start":580,"end":590},{"id":"c2","name":"2교시","type":"class","start":590,"end":630}],"2":[]}'::jsonb
    then raise exception 'weeklySchedule %',got->'weeklySchedule'; end if;
  if got->'weeklySubjects'<>jsonb_build_object(week,'{"1":{"2":"수학"}}'::jsonb) then raise exception 'weeklySubjects %',got->'weeklySubjects'; end if;
  if got->'scheduleClockOffsetSeconds'<>'12'::jsonb then raise exception 'offset %',got; end if;
  if got->'classPrepRelease'<>'{"dateKey":"2026-10-19","slotId":"c2"}'::jsonb then raise exception 'release %',got; end if;
end $$;
reset role;
-- School_Timer가 해제를 지우면 null 값 행이 된다. 시간표가 없으면 모두 null이다.
update public.storage_resources set value='{"kind":"value","parentKey":"","member":"classPrepRelease","data":null}' where resource_key='/classPrepRelease';
delete from public.storage_resources where category in ('weeklySchedule','weeklySubjects','scheduleClockOffsetSeconds');
set local role service_role;
do $$
declare got jsonb:=public.gugudan_class_prep();
begin
  if got->'classPrepRelease'<>'null'::jsonb or got->'weeklySchedule'<>'null'::jsonb or got->'scheduleClockOffsetSeconds'<>'null'::jsonb
    then raise exception 'empty %',got; end if;
end $$;
reset role;
-- 읽기 전용이고 공개 역할은 실행할 수 없다.
do $$ begin
  if has_function_privilege('anon','public.gugudan_class_prep()','execute') or has_function_privilege('authenticated','public.gugudan_class_prep()','execute')
    or has_function_privilege('anon','public.gugudan_storage_tree(text)','execute') or has_function_privilege('authenticated','public.gugudan_storage_tree(text)','execute')
    then raise exception 'public roles can execute'; end if;
  if not has_function_privilege('service_role','public.gugudan_class_prep()','execute') then raise exception 'service_role cannot execute'; end if;
  if (select provolatile from pg_proc where oid='public.gugudan_class_prep()'::regprocedure)<>'s'
    or (select provolatile from pg_proc where oid='public.gugudan_storage_tree(text)'::regprocedure)<>'s' then raise exception 'functions must be stable'; end if;
end $$;
select 'class prep sql ok';
rollback;
