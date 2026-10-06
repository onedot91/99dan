begin;
create table public.gugudan_vertical_runs (
  id uuid primary key,
  student_number smallint not null check(student_number between 1 and 23),
  difficulty smallint not null check(difficulty between 1 and 3),
  questions jsonb not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  score integer check(score between 0 and 1000),
  mistakes integer check(mistakes>=0),
  payload_hash text,
  skill_stats jsonb
);
create index gugudan_vertical_runs_leaders on public.gugudan_vertical_runs(finished_at desc,student_number) where finished_at is not null;
create index gugudan_vertical_runs_metrics on public.gugudan_vertical_runs(student_number,finished_at desc,id desc) where finished_at is not null and skill_stats is not null;
alter table public.gugudan_vertical_runs enable row level security;
revoke all on public.gugudan_vertical_runs from public,anon,authenticated;
grant select,insert,update,delete on public.gugudan_vertical_runs to service_role;

create function public.gugudan_vertical_kind(p_a integer,p_b integer) returns integer
language plpgsql immutable security invoker set search_path='' as $$
declare first_value integer; second_value integer; carry integer:=0; total integer; place integer;
begin
 if p_a is null or p_b is null or p_a not between 10 and 99 or p_b not between 10 and 99 then raise exception 'INVALID_FACT'; end if;
 first_value:=p_a*(p_b%10);second_value:=p_a*(p_b/10)*10;
 for place in 0..length((p_a*p_b)::text)-1 loop
   total:=first_value%10+second_value%10+carry;
   if total>=10 then return 3; end if;
   carry:=total/10;first_value:=first_value/10;second_value:=second_value/10;
 end loop;
 return case when (p_a%10)*(p_b%10)>=10 or (p_a%10)*(p_b/10)>=10 then 2 else 1 end;
end; $$;

create function public.gugudan_vertical_questions(p_difficulty integer) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select jsonb_agg(jsonb_build_object('a',a,'b',b) order by kind,ordinal)
 from (
   select a,b,kind,row_number() over(partition by kind order by random()) as ordinal
   from (
     select a,b,public.gugudan_vertical_kind(a,b) as kind
     from generate_series(10,99) operands_a(a) cross join generate_series(10,99) operands_b(b)
   ) classified
 ) candidates
 where p_difficulty between 1 and 3 and ordinal<=case kind
   when 1 then case p_difficulty when 1 then 2 when 2 then 1 else 0 end
   when 2 then case p_difficulty when 3 then 1 else 2 end
   when 3 then case p_difficulty when 1 then 1 when 2 then 2 else 4 end end;
$$;

create function public.gugudan_vertical_digits(p_a integer,p_b integer) returns integer[]
language plpgsql immutable security invoker set search_path='' as $$
declare digits integer[]:='{}'; shift integer; multiplier integer; unit_value integer; carry integer; tens_value integer;
 first_value integer; second_value integer; total integer; place integer; width integer;
begin
 if p_a is null or p_b is null or p_a not between 10 and 99 or p_b not between 10 and 99 then raise exception 'INVALID_FACT'; end if;
 for shift in 0..1 loop
   multiplier:=case shift when 0 then p_b%10 else p_b/10 end;
   unit_value:=(p_a%10)*multiplier;carry:=unit_value/10;
   digits:=array_append(digits,unit_value%10);
   if multiplier=0 then continue; end if;
   if carry>0 then digits:=array_append(digits,carry); end if;
   tens_value:=(p_a/10)*multiplier+carry;
   digits:=array_append(digits,tens_value%10);
   if tens_value>=10 then digits:=array_append(digits,tens_value/10); end if;
 end loop;
 first_value:=p_a*(p_b%10);second_value:=p_a*(p_b/10)*10;carry:=0;width:=length((p_a*p_b)::text);
 for place in 0..width-1 loop
   total:=first_value%10+second_value%10+carry;
   digits:=array_append(digits,total%10);carry:=total/10;
   if carry>0 and place<width-1 then digits:=array_append(digits,carry); end if;
   first_value:=first_value/10;second_value:=second_value/10;
 end loop;
 return digits;
end; $$;

create function public.gugudan_vertical_skills(p_a integer,p_b integer) returns integer[]
language plpgsql immutable security invoker set search_path='' as $$
declare skills integer[]:='{}'; shift integer; multiplier integer; unit_value integer; carry integer; tens_value integer;
 first_value integer; second_value integer; total integer; place integer; width integer; skill integer;
begin
 if p_a is null or p_b is null or p_a not between 10 and 99 or p_b not between 10 and 99 then raise exception 'INVALID_FACT'; end if;
 for shift in 0..1 loop
   multiplier:=case shift when 0 then p_b%10 else p_b/10 end;
   unit_value:=(p_a%10)*multiplier;carry:=unit_value/10;
   skill:=case when carry>0 then 2 else 1 end;
   skills:=array_append(skills,skill);
   if multiplier=0 then continue; end if;
   if carry>0 then skills:=array_append(skills,skill); end if;
   tens_value:=(p_a/10)*multiplier+carry;
   skills:=array_append(skills,skill);
   if tens_value>=10 then skills:=array_append(skills,skill); end if;
 end loop;
 first_value:=p_a*(p_b%10);second_value:=p_a*(p_b/10)*10;carry:=0;width:=length((p_a*p_b)::text);
 for place in 0..width-1 loop
   total:=first_value%10+second_value%10+carry;
   skills:=array_append(skills,case when carry>0 or total>=10 then 3 else 1 end);
   carry:=total/10;
   if carry>0 and place<width-1 then skills:=array_append(skills,3); end if;
   first_value:=first_value/10;second_value:=second_value/10;
 end loop;
 return skills;
end; $$;

create function public.gugudan_vertical_metrics(p_questions jsonb,p_events jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare event jsonb; fact jsonb; digits integer[]; skills integer[]; seen jsonb:='{}'; cell text;
 question_index integer; step_index integer; skill integer; correct boolean;
 totals integer[]:=array[0,0,0]; successes integer[]:=array[0,0,0];
begin
 for event in select value from jsonb_array_elements(p_events) loop
   question_index:=(event->>'question')::integer;step_index:=(event->>'step')::integer;
   cell:=question_index||':'||step_index;
   if seen ? cell then continue; end if;
   seen:=seen||jsonb_build_object(cell,true);
   fact:=p_questions->question_index;
   digits:=public.gugudan_vertical_digits((fact->>'a')::integer,(fact->>'b')::integer);
   skills:=public.gugudan_vertical_skills((fact->>'a')::integer,(fact->>'b')::integer);
   correct:=(event->>'answer')::integer=digits[step_index+1];skill:=skills[step_index+1];
   totals[1]:=totals[1]+1;successes[1]:=successes[1]+case when correct then 1 else 0 end;
   if skill>1 then totals[skill]:=totals[skill]+1;successes[skill]:=successes[skill]+case when correct then 1 else 0 end; end if;
 end loop;
 return jsonb_build_object('first',jsonb_build_object('attempts',totals[1],'correct',successes[1]),'multiply',jsonb_build_object('attempts',totals[2],'correct',successes[2]),'sum',jsonb_build_object('attempts',totals[3],'correct',successes[3]));
end; $$;

create function public.gugudan_teacher_vertical_metrics() returns jsonb
language sql stable security invoker set search_path='' as $$
 with ranked as (
   select student_number,skill_stats,row_number() over(partition by student_number order by finished_at desc,id desc) as ordinal
   from public.gugudan_vertical_runs where finished_at is not null and skill_stats is not null
 ), summaries as (
   select student_number,count(*) as runs,
     sum((skill_stats->'first'->>'attempts')::integer) as first_attempts,sum((skill_stats->'first'->>'correct')::integer) as first_correct,
     sum((skill_stats->'multiply'->>'attempts')::integer) as multiply_attempts,sum((skill_stats->'multiply'->>'correct')::integer) as multiply_correct,
     sum((skill_stats->'sum'->>'attempts')::integer) as sum_attempts,sum((skill_stats->'sum'->>'correct')::integer) as sum_correct
   from ranked where ordinal<=3 group by student_number
 )
 select coalesce(jsonb_agg(jsonb_build_object('studentNumber',student_number,'stats',jsonb_build_object('runs',runs,
   'first',jsonb_build_object('attempts',first_attempts,'correct',first_correct),
   'multiply',jsonb_build_object('attempts',multiply_attempts,'correct',multiply_correct),
   'sum',jsonb_build_object('attempts',sum_attempts,'correct',sum_correct))) order by student_number),'[]') from summaries;
$$;

create function public.gugudan_vertical_begin(p_student integer,p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen integer; r public.gugudan_vertical_runs;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null then raise exception 'INVALID_RUN'; end if;
 chosen:=(public.gugudan_vertical_assignment(p_student)->>'difficulty')::integer;
 insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions)
 values(p_id,p_student,chosen,public.gugudan_vertical_questions(chosen)) on conflict do nothing;
 select * into r from public.gugudan_vertical_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'studentNumber',p_student,'difficulty',r.difficulty,'questions',r.questions);
end; $$;

create function public.gugudan_vertical_finish(p_student integer,p_id uuid,p_events jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.gugudan_vertical_runs; event jsonb; fact jsonb; digits integer[];
 question_index integer:=0; step_index integer:=0; wrong_count integer:=0; points integer; event_hash text;
begin
 if coalesce(jsonb_typeof(p_events),'')<>'array' or jsonb_array_length(p_events)>2000 then raise exception 'INVALID_EVENTS'; end if;
 select * into r from public.gugudan_vertical_runs where id=p_id and student_number=p_student for update;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 event_hash:=md5(p_events::text);
 if r.finished_at is not null then
   if r.payload_hash<>event_hash then raise exception 'RUN_ALREADY_FINISHED'; end if;
   return jsonb_build_object('id',r.id,'score',r.score);
 end if;
 fact:=r.questions->0;digits:=public.gugudan_vertical_digits((fact->>'a')::integer,(fact->>'b')::integer);
 for event in select value from jsonb_array_elements(p_events) loop
   if jsonb_typeof(event)<>'object' or jsonb_typeof(event->'question') is distinct from 'number' or jsonb_typeof(event->'step') is distinct from 'number' or jsonb_typeof(event->'answer') is distinct from 'number'
      or coalesce(event->>'question','') !~ '^[0-4]$' or coalesce(event->>'step','') !~ '^[0-9]{1,2}$' or coalesce(event->>'answer','') !~ '^[0-9]$' then raise exception 'INVALID_ANSWER'; end if;
   if question_index>=5 or (event->>'question')::integer<>question_index or (event->>'step')::integer<>step_index then raise exception 'INVALID_SEQUENCE'; end if;
   if (event->>'answer')::integer=digits[step_index+1] then
     step_index:=step_index+1;
     if step_index=array_length(digits,1) then
       question_index:=question_index+1;step_index:=0;
       if question_index<5 then fact:=r.questions->question_index;digits:=public.gugudan_vertical_digits((fact->>'a')::integer,(fact->>'b')::integer); end if;
     end if;
   else wrong_count:=wrong_count+1; end if;
 end loop;
 if question_index<>5 or step_index<>0 then raise exception 'INCOMPLETE_RUN'; end if;
 points:=greatest(0,1000-wrong_count*30);
 update public.gugudan_vertical_runs set finished_at=clock_timestamp(),score=points,mistakes=wrong_count,payload_hash=event_hash,skill_stats=public.gugudan_vertical_metrics(r.questions,p_events) where id=p_id;
 return jsonb_build_object('id',p_id,'score',points);
end; $$;

create function public.gugudan_vertical_leaders() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]') from (
   select best.student_number as "studentNumber",best.score,5 as correct,
     (select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||best.student_number and not deleted) as avatar
   from (
     select distinct on(student_number) student_number,score,finished_at
     from public.gugudan_vertical_runs
     where finished_at>now()-interval '7 days'
     order by student_number,score desc,finished_at,id
   ) best order by best.score desc,best.finished_at,best.student_number limit 5
 ) row;
$$;

create or replace function public.gugudan_teacher_reset(p_student integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_student is null or p_student not between 1 and 23 then raise exception 'INVALID_STUDENT'; end if;
 delete from public.gugudan_vertical_runs where student_number=p_student and finished_at is not null;
 delete from public.gugudan_runs where student_number=p_student;
 delete from public.gugudan_weekly_leaders where student_number=p_student;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0,friends='[]',partner=null where student_number=p_student;
end; $$;
create or replace function public.gugudan_teacher_reset_all() returns void
language plpgsql security invoker set search_path='' as $$
begin
 delete from public.gugudan_vertical_runs where student_number between 1 and 23 and finished_at is not null;
 delete from public.gugudan_runs where student_number between 1 and 23;
 delete from public.gugudan_weekly_leaders where student_number between 1 and 23;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0,friends='[]',partner=null where student_number between 1 and 23;
end; $$;
revoke all on function public.gugudan_vertical_kind(integer,integer),public.gugudan_vertical_questions(integer),public.gugudan_vertical_digits(integer,integer),public.gugudan_vertical_begin(integer,uuid),public.gugudan_vertical_finish(integer,uuid,jsonb),public.gugudan_vertical_leaders() from public,anon,authenticated;
grant execute on function public.gugudan_vertical_kind(integer,integer),public.gugudan_vertical_questions(integer),public.gugudan_vertical_digits(integer,integer),public.gugudan_vertical_begin(integer,uuid),public.gugudan_vertical_finish(integer,uuid,jsonb),public.gugudan_vertical_leaders() to service_role;
revoke all on function public.gugudan_vertical_skills(integer,integer),public.gugudan_vertical_metrics(jsonb,jsonb),public.gugudan_teacher_vertical_metrics() from public,anon,authenticated;
grant execute on function public.gugudan_vertical_skills(integer,integer),public.gugudan_vertical_metrics(jsonb,jsonb),public.gugudan_teacher_vertical_metrics() to service_role;
commit;
