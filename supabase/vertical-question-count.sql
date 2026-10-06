begin;
alter table public.gugudan_vertical_runs drop constraint gugudan_vertical_runs_score_check;
alter table public.gugudan_vertical_runs add constraint gugudan_vertical_runs_score_check check(score between 0 and 2000);
create function public.gugudan_vertical_questions_count(p_difficulty integer,p_count integer) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_difficulty is null or p_difficulty not between 1 and 3 or p_count is null or p_count not in (5,10) then raise exception 'INVALID_RUN'; end if;
 if p_count=5 then return public.gugudan_vertical_questions(p_difficulty); end if;
 select jsonb_agg(jsonb_build_object('a',a,'b',b) order by kind,ordinal) into result
 from (
   select a,b,kind,row_number() over(partition by kind order by random()) as ordinal
   from (
     select a,b,public.gugudan_vertical_kind(a,b) as kind
     from generate_series(10,99) operands_a(a) cross join generate_series(10,99) operands_b(b)
   ) classified
 ) candidates
 where ordinal<=2*case kind
   when 1 then case p_difficulty when 1 then 2 when 2 then 1 else 0 end
   when 2 then case p_difficulty when 3 then 1 else 2 end
   when 3 then case p_difficulty when 1 then 1 when 2 then 2 else 4 end end;
 return result;
end; $$;

create function public.gugudan_vertical_begin_count(p_student integer,p_id uuid,p_count integer,p_timed boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen integer; r public.gugudan_vertical_runs;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null or p_count is null or p_count not in (5,10) or p_timed is null then raise exception 'INVALID_RUN'; end if;
 chosen:=(public.gugudan_vertical_assignment(p_student)->>'difficulty')::integer;
 insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,scoring_version)
 values(p_id,p_student,chosen,public.gugudan_vertical_questions_count(chosen,p_count),case when p_timed then 2 else 1 end) on conflict do nothing;
 select * into r from public.gugudan_vertical_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 if jsonb_array_length(r.questions)<>p_count then raise exception 'RUN_COUNT_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'studentNumber',p_student,'difficulty',r.difficulty,'questions',r.questions,'timeScoring',r.scoring_version=2);
end; $$;

create or replace function public.gugudan_vertical_finish(p_student integer,p_id uuid,p_events jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.gugudan_vertical_runs; event jsonb; fact jsonb; digits integer[];
 question_index integer:=0; step_index integer:=0; wrong_count integer:=0; question_count integer; points integer; event_hash text;
 elapsed_ms integer:=0; previous_ms integer:=0; question_ms integer:=0; time_penalty integer:=0;
begin
 if coalesce(jsonb_typeof(p_events),'')<>'array' or jsonb_array_length(p_events)>2000 then raise exception 'INVALID_EVENTS'; end if;
 select * into r from public.gugudan_vertical_runs where id=p_id and student_number=p_student for update;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 event_hash:=md5(p_events::text);
 if r.finished_at is not null then
   if r.payload_hash<>event_hash then raise exception 'RUN_ALREADY_FINISHED'; end if;
   return jsonb_build_object('id',r.id,'score',r.score);
 end if;
 question_count:=jsonb_array_length(r.questions);
 if question_count not in (5,10) then raise exception 'INVALID_RUN'; end if;
 fact:=r.questions->0;digits:=public.gugudan_vertical_digits((fact->>'a')::integer,(fact->>'b')::integer);
 for event in select value from jsonb_array_elements(p_events) loop
   if jsonb_typeof(event)<>'object' or jsonb_typeof(event->'question') is distinct from 'number' or jsonb_typeof(event->'step') is distinct from 'number' or jsonb_typeof(event->'answer') is distinct from 'number'
      or coalesce(event->>'question','') !~ '^[0-9]$' or coalesce(event->>'step','') !~ '^[0-9]{1,2}$' or coalesce(event->>'answer','') !~ '^[0-9]$' then raise exception 'INVALID_ANSWER'; end if;
   if question_index>=question_count or (event->>'question')::integer<>question_index or (event->>'step')::integer<>step_index then raise exception 'INVALID_SEQUENCE'; end if;
   if r.scoring_version=2 then
     if jsonb_typeof(event->'ms') is distinct from 'number' or coalesce(event->>'ms','') !~ '^[0-9]{1,10}$' then raise exception 'INVALID_TIME'; end if;
     if (event->>'ms')::bigint>1000000000 then raise exception 'INVALID_TIME'; end if;
     elapsed_ms:=(event->>'ms')::integer;
     if elapsed_ms<previous_ms then raise exception 'INVALID_TIME'; end if;
     previous_ms:=elapsed_ms;
   end if;
   if (event->>'answer')::integer=digits[step_index+1] then
     question_ms:=question_ms+least(elapsed_ms,20000);previous_ms:=0;
     step_index:=step_index+1;
     if step_index=array_length(digits,1) then
       time_penalty:=time_penalty+question_ms/(5000*array_length(digits,1));question_ms:=0;
       question_index:=question_index+1;step_index:=0;
       if question_index<question_count then fact:=r.questions->question_index;digits:=public.gugudan_vertical_digits((fact->>'a')::integer,(fact->>'b')::integer); end if;
     end if;
   else wrong_count:=wrong_count+1; end if;
 end loop;
 if question_index<>question_count or step_index<>0 then raise exception 'INCOMPLETE_RUN'; end if;
 points:=greatest(0,question_count*200-wrong_count*30-time_penalty);
 update public.gugudan_vertical_runs set finished_at=clock_timestamp(),score=points,mistakes=wrong_count,payload_hash=event_hash,skill_stats=public.gugudan_vertical_metrics(r.questions,p_events) where id=p_id;
 return jsonb_build_object('id',p_id,'score',points);
end; $$;


create function public.gugudan_vertical_leaders_count(p_count integer) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if p_count is null or p_count not in (5,10) then raise exception 'INVALID_COUNT'; end if;
 select coalesce(jsonb_agg(row),'[]') into result from (
   select best.student_number as "studentNumber",best.score,p_count as correct,
     (select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||best.student_number and not deleted) as avatar
   from (
     select distinct on(student_number) student_number,score,finished_at
     from public.gugudan_vertical_runs
     where finished_at>now()-interval '7 days' and jsonb_array_length(questions)=p_count
     order by student_number,score desc,finished_at,id
   ) best order by best.score desc,best.finished_at,best.student_number limit 5
 ) row;
 return result;
end; $$;

create or replace function public.gugudan_vertical_leaders() returns jsonb
language sql stable security invoker set search_path='' as $$
 select public.gugudan_vertical_leaders_count(5);
$$;

revoke all on function public.gugudan_vertical_questions_count(integer,integer),public.gugudan_vertical_begin_count(integer,uuid,integer,boolean),public.gugudan_vertical_leaders_count(integer) from public,anon,authenticated;
grant execute on function public.gugudan_vertical_questions_count(integer,integer),public.gugudan_vertical_begin_count(integer,uuid,integer,boolean),public.gugudan_vertical_leaders_count(integer) to service_role;
commit;
