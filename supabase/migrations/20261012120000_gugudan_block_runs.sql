-- 블록 종목(세로셈 나눗셈 × 블록, 무한 모드)의 서버 기록 (2026-10-12).
-- 시작하면 서버가 시드를 발급해 ID별로 저장한다. 끝(막힘·그만하기)에 Edge Function이 같은 시드로
-- src/game/blockRun.ts의 replayBlockRun을 돌려 점수를 다시 계산하고, 그 결과와 입력 기록을 여기에 저장한다.
-- 같은 ID·같은 입력(payload_hash)의 재전송은 저장된 결과를 돌려주고, 다른 입력은 거부한다.
-- 경험치는 두 자리 수와 같이 끝낸 문제당 20(src/game/learning.ts의 VERTICAL_EXP_PER_QUESTION)이다.
begin;
create table public.gugudan_block_runs (
  id uuid primary key,
  student_number smallint not null check(student_number between 1 and 23),
  seed bigint not null check(seed between 0 and 4294967295),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  ended text check(ended in ('stuck','stopped')),
  score integer check(score>=0),
  solved integer check(solved>=0),
  mistakes integer check(mistakes>=0),
  lines integer check(lines>=0),
  answers jsonb,
  moves jsonb,
  payload_hash text check(payload_hash ~ '^[0-9a-f]{64}$'),
  check((finished_at is null)=(score is null) and (finished_at is null)=(payload_hash is null) and (finished_at is null)=(ended is null))
);
create index gugudan_block_runs_leaders on public.gugudan_block_runs(finished_at desc,student_number) where finished_at is not null;
create index gugudan_block_runs_student on public.gugudan_block_runs(student_number,finished_at desc) where finished_at is not null;
alter table public.gugudan_block_runs enable row level security;
revoke all on public.gugudan_block_runs from public,anon,authenticated;
grant select,insert,update,delete on public.gugudan_block_runs to service_role;

-- 같은 ID로 다시 시작하면(응답 유실 후 재시도) 처음 발급한 시드를 그대로 돌려준다.
create function public.gugudan_block_begin(p_student integer,p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.gugudan_block_runs;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null then raise exception 'INVALID_RUN'; end if;
 insert into public.gugudan_block_runs(id,student_number,seed) values(p_id,p_student,floor(random()*4294967296)::bigint) on conflict do nothing;
 select * into r from public.gugudan_block_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'seed',r.seed);
end; $$;

-- Edge Function이 재생 전에 시드를 읽는다. 다른 학생의 ID는 없는 것으로 본다.
create function public.gugudan_block_seed(p_student integer,p_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare r public.gugudan_block_runs;
begin
 select * into r from public.gugudan_block_runs where id=p_id and student_number=p_student;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 return jsonb_build_object('id',r.id,'seed',r.seed);
end; $$;

-- 점수·통계는 Edge Function이 재생으로 계산한 값이다(이 함수는 service_role만 부른다). p_seed로 재생에 쓴 시드를 확인한다.
create function public.gugudan_block_finish(p_student integer,p_id uuid,p_seed bigint,p_hash text,p_ended text,p_score integer,p_solved integer,p_mistakes integer,p_lines integer,p_answers jsonb,p_moves jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.gugudan_block_runs;
begin
 if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_ended is null or p_ended not in ('stuck','stopped')
 or p_score is null or p_score<0 or p_solved is null or p_solved<0 or p_mistakes is null or p_mistakes<0 or p_lines is null or p_lines<0
 or coalesce(jsonb_typeof(p_answers),'')<>'array' or coalesce(jsonb_typeof(p_moves),'')<>'array' then raise exception 'INVALID_RUN'; end if;
 select * into r from public.gugudan_block_runs where id=p_id and student_number=p_student for update;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 if r.seed<>p_seed then raise exception 'RUN_SEED_MISMATCH'; end if;
 if r.finished_at is not null then
   if r.payload_hash<>p_hash then raise exception 'RUN_ALREADY_FINISHED'; end if;
   return jsonb_build_object('id',r.id,'score',r.score,'solved',r.solved,'lines',r.lines,'ended',r.ended);
 end if;
 update public.gugudan_block_runs set finished_at=clock_timestamp(),ended=p_ended,score=p_score,solved=p_solved,mistakes=p_mistakes,lines=p_lines,
   answers=p_answers,moves=p_moves,payload_hash=p_hash where id=p_id;
 return jsonb_build_object('id',p_id,'score',p_score,'solved',p_solved,'lines',p_lines,'ended',p_ended);
end; $$;

-- 명예의 전당 `블록`: 학생별 최근 7일 최고 점수 상위 5명. 같은 점수는 먼저 달성한 순, 그다음 번호 순.
create function public.gugudan_block_leaders() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]') from (
   select best.student_number as "studentNumber",best.score,best.solved as correct,
     (select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||best.student_number and not deleted) as avatar
   from (
     select distinct on(student_number) student_number,score,solved,finished_at
     from public.gugudan_block_runs
     where finished_at>now()-interval '7 days'
     order by student_number,score desc,finished_at,id
   ) best order by best.score desc,best.finished_at,best.student_number limit 5
 ) row;
$$;

create function public.gugudan_block_exp(p_student integer) returns integer
language sql stable security invoker set search_path='' as $$
 select coalesce(sum(solved),0)::integer*20
 from public.gugudan_block_runs where student_number=p_student and finished_at is not null;
$$;

-- 학생 본인의 블록 기록(내 기록·결과 화면의 최고 점수).
create function public.gugudan_block_records(p_student integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('best',max(score),'runs',count(*))
 from public.gugudan_block_runs where student_number=p_student and finished_at is not null;
$$;

-- 교사 화면: 학생마다 최근 블록 5판과 경험치(두 자리 수 경험치도 전체 기록으로 함께 계산).
create function public.gugudan_teacher_block_records() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'studentNumber',n,
   'blockExp',public.gugudan_block_exp(n),
   'verticalExp',public.gugudan_vertical_exp(n),
   'blockSessions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'finishedAt',finished_at,'score',score,'solved',solved,'lines',lines,'mistakes',mistakes,'ended',ended) order by finished_at desc)
     from (select * from public.gugudan_block_runs b where b.student_number=n and b.finished_at is not null order by b.finished_at desc limit 5) recent),'[]')
 ) order by n),'[]')
 from generate_series(1,23) n;
$$;

create or replace function public.gugudan_profile(p_student integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('studentNumber',p_student,
   'avatar',(select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||p_student and not deleted),
   'records',coalesce(p.records,'{}'), 'sessions',coalesce(p.sessions,'[]'),
   'best',coalesce((select jsonb_agg(value order by key) from jsonb_each(p.best) where value->>'scoringVersion'='5'),'[]'),
   'friends',coalesce(p.friends,'[]'),'partner',p.partner,
   'verticalExp',public.gugudan_vertical_exp(p_student),
   'blockExp',public.gugudan_block_exp(p_student))
 from (select p_student as n) input left join public.gugudan_players p on p.student_number=input.n
 where p_student between 1 and 23;
$$;

create or replace function public.gugudan_save_friends(p_student integer,p_friends jsonb,p_partner text) returns void
language plpgsql security invoker set search_path='' as $$
declare
 v_correct integer;
 v_count integer;
 v_existing jsonb;
 v_level integer;
begin
 if p_student not between 1 and 23 or jsonb_typeof(p_friends)<>'array' then raise exception 'INVALID_FRIENDS'; end if;
 if exists(select 1 from jsonb_array_elements(p_friends) e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^[a-z]+(\.[a-z]+){0,4}$') then raise exception 'INVALID_FRIENDS'; end if;
 select count(*) into v_count from jsonb_array_elements(p_friends) e having count(*)=count(distinct e#>>'{}');
 if v_count is null then raise exception 'DUPLICATE_FRIENDS'; end if;
 if exists(select 1 from jsonb_array_elements_text(p_friends) id
   where id like '%.%' and not p_friends ? regexp_replace(id,'\.[a-z]+$','')) then raise exception 'MISSING_PARENT'; end if;
 if p_partner is not null and not p_friends ? p_partner then raise exception 'INVALID_PARTNER'; end if;
 insert into public.gugudan_players(student_number) values(p_student) on conflict do nothing;
 select coalesce(sum((r.value->>'correct')::integer),0) into v_correct
   from public.gugudan_players p,jsonb_each(p.records) r where p.student_number=p_student;
 v_correct:=v_correct+public.gugudan_vertical_exp(p_student)+public.gugudan_block_exp(p_student);
 select friends into v_existing from public.gugudan_players where student_number=p_student;
 v_level:=case when v_correct>=100 then 5+(v_correct-100)/50
   when v_correct>=60 then 4 when v_correct>=30 then 3 when v_correct>=10 then 2 else 1 end;
 if v_count>v_level and not v_existing @> p_friends then raise exception 'TOO_MANY_FRIENDS'; end if;
 update public.gugudan_players set friends=p_friends,partner=p_partner where student_number=p_student;
end; $$;

-- 초기화: 진행 중인 판은 남긴다(두 자리 수와 같음). 끝낸 판을 지우면 그 경험치와 순위도 빠진다.
create or replace function public.gugudan_teacher_reset(p_student integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_student is null or p_student not between 1 and 23 then raise exception 'INVALID_STUDENT'; end if;
 delete from public.gugudan_block_runs where student_number=p_student and finished_at is not null;
 delete from public.gugudan_vertical_runs where student_number=p_student and finished_at is not null;
 delete from public.gugudan_runs where student_number=p_student;
 delete from public.gugudan_weekly_leaders where student_number=p_student;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0,friends='[]',partner=null where student_number=p_student;
end; $$;
create or replace function public.gugudan_teacher_reset_all() returns void
language plpgsql security invoker set search_path='' as $$
begin
 delete from public.gugudan_block_runs where student_number between 1 and 23 and finished_at is not null;
 delete from public.gugudan_vertical_runs where student_number between 1 and 23 and finished_at is not null;
 delete from public.gugudan_runs where student_number between 1 and 23;
 delete from public.gugudan_weekly_leaders where student_number between 1 and 23;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0,friends='[]',partner=null where student_number between 1 and 23;
end; $$;

create or replace function public.gugudan_teacher_reset_scoped(p_student integer,p_scopes jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare durations integer[]; counts integer[];
begin
 if p_student is null or p_student not between 1 and 23 then raise exception 'INVALID_STUDENT'; end if;
 if coalesce(jsonb_typeof(p_scopes),'')<>'array' then raise exception 'INVALID_RESET_SCOPES'; end if;
 if jsonb_array_length(p_scopes) not between 1 and 6
 or exists(select 1 from jsonb_array_elements(p_scopes) s where jsonb_typeof(s)<>'string' or s#>>'{}' not in ('rush-1','rush-2','rush-3','vertical-5','vertical-10','block'))
 or (select count(distinct s) from jsonb_array_elements(p_scopes) s)<>jsonb_array_length(p_scopes)
 then raise exception 'INVALID_RESET_SCOPES'; end if;
 select coalesce(array_agg(right(s,1)::integer),'{}') into durations from jsonb_array_elements_text(p_scopes) s where s like 'rush-%';
 select coalesce(array_agg(substring(s from 10)::integer),'{}') into counts from jsonb_array_elements_text(p_scopes) s where s like 'vertical-%';
 perform 1 from public.gugudan_players where student_number=p_student for update;
 if cardinality(durations)>0 then
   -- Leave active runs untouched; finishing them later creates a new result.
   delete from public.gugudan_runs where student_number=p_student and mode='rush' and duration=any(durations) and finished_at is not null;
   update public.gugudan_players p set
     sessions=coalesce((select jsonb_agg(s order by ord) from jsonb_array_elements(p.sessions) with ordinality v(s,ord)
       where not(s->>'mode'='rush' and (s->>'duration')::integer=any(durations))),'[]'),
     best=p.best-array(select d::text from unnest(durations) d)
   where p.student_number=p_student;
   delete from public.gugudan_weekly_leaders where student_number=p_student and duration=any(durations);
 end if;
 if cardinality(counts)>0 then
   delete from public.gugudan_vertical_runs where student_number=p_student and finished_at is not null and jsonb_array_length(questions)=any(counts);
 end if;
 if p_scopes ? 'block' then
   delete from public.gugudan_block_runs where student_number=p_student and finished_at is not null;
 end if;
end; $$;

revoke all on function public.gugudan_block_begin(integer,uuid),public.gugudan_block_seed(integer,uuid),
  public.gugudan_block_finish(integer,uuid,bigint,text,text,integer,integer,integer,integer,jsonb,jsonb),
  public.gugudan_block_leaders(),public.gugudan_block_exp(integer),public.gugudan_block_records(integer),public.gugudan_teacher_block_records()
  from public,anon,authenticated;
grant execute on function public.gugudan_block_begin(integer,uuid),public.gugudan_block_seed(integer,uuid),
  public.gugudan_block_finish(integer,uuid,bigint,text,text,integer,integer,integer,integer,jsonb,jsonb),
  public.gugudan_block_leaders(),public.gugudan_block_exp(integer),public.gugudan_block_records(integer),public.gugudan_teacher_block_records()
  to service_role;
commit;
