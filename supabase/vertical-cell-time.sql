begin;
alter table public.gugudan_vertical_runs add column scoring_version smallint not null default 1 check(scoring_version in (1,2));

create function public.gugudan_vertical_begin_timed(p_student integer,p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen integer; r public.gugudan_vertical_runs;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null then raise exception 'INVALID_RUN'; end if;
 chosen:=(public.gugudan_vertical_assignment(p_student)->>'difficulty')::integer;
 insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,scoring_version)
 values(p_id,p_student,chosen,public.gugudan_vertical_questions(chosen),2) on conflict do nothing;
 select * into r from public.gugudan_vertical_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'studentNumber',p_student,'difficulty',r.difficulty,'questions',r.questions,'timeScoring',r.scoring_version=2);
end; $$;

create or replace function public.gugudan_vertical_begin(p_student integer,p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen integer; r public.gugudan_vertical_runs;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null then raise exception 'INVALID_RUN'; end if;
 chosen:=(public.gugudan_vertical_assignment(p_student)->>'difficulty')::integer;
 insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions)
 values(p_id,p_student,chosen,public.gugudan_vertical_questions(chosen)) on conflict do nothing;
 select * into r from public.gugudan_vertical_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'studentNumber',p_student,'difficulty',r.difficulty,'questions',r.questions,'timeScoring',r.scoring_version=2);
end; $$;

create or replace function public.gugudan_vertical_finish(p_student integer,p_id uuid,p_events jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.gugudan_vertical_runs; event jsonb; fact jsonb; digits integer[];
 question_index integer:=0; step_index integer:=0; wrong_count integer:=0; points integer; event_hash text;
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
 fact:=r.questions->0;digits:=public.gugudan_vertical_digits((fact->>'a')::integer,(fact->>'b')::integer);
 for event in select value from jsonb_array_elements(p_events) loop
   if jsonb_typeof(event)<>'object' or jsonb_typeof(event->'question') is distinct from 'number' or jsonb_typeof(event->'step') is distinct from 'number' or jsonb_typeof(event->'answer') is distinct from 'number'
      or coalesce(event->>'question','') !~ '^[0-4]$' or coalesce(event->>'step','') !~ '^[0-9]{1,2}$' or coalesce(event->>'answer','') !~ '^[0-9]$' then raise exception 'INVALID_ANSWER'; end if;
   if question_index>=5 or (event->>'question')::integer<>question_index or (event->>'step')::integer<>step_index then raise exception 'INVALID_SEQUENCE'; end if;
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
       if question_index<5 then fact:=r.questions->question_index;digits:=public.gugudan_vertical_digits((fact->>'a')::integer,(fact->>'b')::integer); end if;
     end if;
   else wrong_count:=wrong_count+1; end if;
 end loop;
 if question_index<>5 or step_index<>0 then raise exception 'INCOMPLETE_RUN'; end if;
 points:=greatest(0,1000-wrong_count*30-time_penalty);
 update public.gugudan_vertical_runs set finished_at=clock_timestamp(),score=points,mistakes=wrong_count,payload_hash=event_hash,skill_stats=public.gugudan_vertical_metrics(r.questions,p_events) where id=p_id;
 return jsonb_build_object('id',p_id,'score',points);
end; $$;

revoke all on function public.gugudan_vertical_begin_timed(integer,uuid) from public,anon,authenticated;
grant execute on function public.gugudan_vertical_begin_timed(integer,uuid) to service_role;
commit;
