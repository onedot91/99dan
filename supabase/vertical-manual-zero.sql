begin;
alter table public.gugudan_vertical_runs add column manual_zero boolean not null default false;

create function public.gugudan_vertical_cells(p_a integer,p_b integer,p_manual boolean,p_skills boolean) returns integer[]
language plpgsql immutable security invoker set search_path='' as $$
declare cells integer[]; ones_count integer:=1; multiplier integer; carry integer; tens_value integer;
begin
 cells:=case when p_skills then public.gugudan_vertical_skills(p_a,p_b) else public.gugudan_vertical_digits(p_a,p_b) end;
 if not p_manual then return cells; end if;
 multiplier:=p_b%10;
 if multiplier>0 then
   carry:=((p_a%10)*multiplier)/10;tens_value:=(p_a/10)*multiplier+carry;
   ones_count:=ones_count+1+case when carry>0 then 1 else 0 end+case when tens_value>=10 then 1 else 0 end;
 end if;
 return cells[1:ones_count]||array[case when p_skills then 1 else 0 end]||cells[ones_count+1:array_length(cells,1)];
end; $$;

create function public.gugudan_vertical_metrics_manual(p_questions jsonb,p_events jsonb) returns jsonb
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
   digits:=public.gugudan_vertical_cells((fact->>'a')::integer,(fact->>'b')::integer,true,false);
   skills:=public.gugudan_vertical_cells((fact->>'a')::integer,(fact->>'b')::integer,true,true);
   correct:=(event->>'answer')::integer=digits[step_index+1];skill:=skills[step_index+1];
   totals[1]:=totals[1]+1;successes[1]:=successes[1]+case when correct then 1 else 0 end;
   if skill>1 then totals[skill]:=totals[skill]+1;successes[skill]:=successes[skill]+case when correct then 1 else 0 end; end if;
 end loop;
 return jsonb_build_object('first',jsonb_build_object('attempts',totals[1],'correct',successes[1]),'multiply',jsonb_build_object('attempts',totals[2],'correct',successes[2]),'sum',jsonb_build_object('attempts',totals[3],'correct',successes[3]));
end; $$;

create function public.gugudan_vertical_begin_manual(p_student integer,p_id uuid,p_count integer,p_timed boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen integer; r public.gugudan_vertical_runs;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null or p_count is null or p_count not in (5,10) or p_timed is null then raise exception 'INVALID_RUN'; end if;
 chosen:=(public.gugudan_vertical_assignment(p_student)->>'difficulty')::integer;
 insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,scoring_version,manual_zero)
 values(p_id,p_student,chosen,public.gugudan_vertical_questions_count(chosen,p_count),case when p_timed then 2 else 1 end,true) on conflict do nothing;
 select * into r from public.gugudan_vertical_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 if jsonb_array_length(r.questions)<>p_count then raise exception 'RUN_COUNT_CONFLICT'; end if;
 if not r.manual_zero then raise exception 'RUN_MODE_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'studentNumber',p_student,'difficulty',r.difficulty,'questions',r.questions,'timeScoring',r.scoring_version=2,'manualZero',true);
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
 fact:=r.questions->0;digits:=public.gugudan_vertical_cells((fact->>'a')::integer,(fact->>'b')::integer,r.manual_zero,false);
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
       if question_index<question_count then fact:=r.questions->question_index;digits:=public.gugudan_vertical_cells((fact->>'a')::integer,(fact->>'b')::integer,r.manual_zero,false); end if;
     end if;
   else wrong_count:=wrong_count+1; end if;
 end loop;
 if question_index<>question_count or step_index<>0 then raise exception 'INCOMPLETE_RUN'; end if;
 points:=greatest(0,question_count*200-wrong_count*30-time_penalty);
 update public.gugudan_vertical_runs set finished_at=clock_timestamp(),score=points,mistakes=wrong_count,payload_hash=event_hash,
   skill_stats=case when r.manual_zero then public.gugudan_vertical_metrics_manual(r.questions,p_events) else public.gugudan_vertical_metrics(r.questions,p_events) end where id=p_id;
 return jsonb_build_object('id',p_id,'score',points);
end; $$;

revoke all on function public.gugudan_vertical_cells(integer,integer,boolean,boolean),public.gugudan_vertical_metrics_manual(jsonb,jsonb),public.gugudan_vertical_begin_manual(integer,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.gugudan_vertical_cells(integer,integer,boolean,boolean),public.gugudan_vertical_metrics_manual(jsonb,jsonb),public.gugudan_vertical_begin_manual(integer,uuid,integer,boolean) to service_role;
commit;
