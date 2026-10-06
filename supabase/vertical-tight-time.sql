begin;
alter table public.gugudan_vertical_runs add column tight_time boolean not null default false
 check(not tight_time or scoring_version=2);

create function public.gugudan_vertical_begin_tight(p_student integer,p_id uuid,p_count integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen integer; r public.gugudan_vertical_runs;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null or p_count is null or p_count not in (5,10) then raise exception 'INVALID_RUN'; end if;
 chosen:=(public.gugudan_vertical_assignment(p_student)->>'difficulty')::integer;
 insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,scoring_version,manual_zero,tight_time)
 values(p_id,p_student,chosen,public.gugudan_vertical_questions_direct_zero(chosen,p_count),2,true,true) on conflict do nothing;
 select * into r from public.gugudan_vertical_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 if jsonb_array_length(r.questions)<>p_count then raise exception 'RUN_COUNT_CONFLICT'; end if;
 if not r.tight_time then raise exception 'RUN_MODE_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'studentNumber',p_student,'difficulty',r.difficulty,'questions',r.questions,'timeScoring',true,'manualZero',true,'puzzles',true,'puzzleOperands',true,'directZero',true,'tightTime',true);
end; $$;

create or replace function public.gugudan_vertical_finish(p_student integer,p_id uuid,p_events jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.gugudan_vertical_runs; event jsonb; fact jsonb; digits integer[]; solved boolean[]; cell_times integer[];
 question_index integer:=0; answered_count integer:=0; event_step integer; wrong_count integer:=0; question_count integer; points integer; event_hash text;
 elapsed_ms integer:=0; question_ms integer:=0; time_penalty integer:=0;
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
 fact:=r.questions->0;digits:=public.gugudan_vertical_question_cells(fact,r.manual_zero,false);
 solved:=array_fill(false,array[array_length(digits,1)]);cell_times:=array_fill(0,array[array_length(digits,1)]);
 for event in select value from jsonb_array_elements(p_events) loop
   if jsonb_typeof(event)<>'object' or jsonb_typeof(event->'question') is distinct from 'number' or jsonb_typeof(event->'step') is distinct from 'number' or jsonb_typeof(event->'answer') is distinct from 'number'
      or coalesce(event->>'question','') !~ '^[0-9]$' or coalesce(event->>'step','') !~ '^[0-9]{1,2}$' or coalesce(event->>'answer','') !~ '^[0-9]$' then raise exception 'INVALID_ANSWER'; end if;
   event_step:=(event->>'step')::integer;
   if question_index>=question_count or (event->>'question')::integer<>question_index or event_step>=array_length(digits,1) or solved[event_step+1] or not (fact ? 'holes') and event_step<>answered_count then raise exception 'INVALID_SEQUENCE'; end if;
   if r.scoring_version=2 then
     if jsonb_typeof(event->'ms') is distinct from 'number' or coalesce(event->>'ms','') !~ '^[0-9]{1,10}$' then raise exception 'INVALID_TIME'; end if;
     if (event->>'ms')::bigint>1000000000 then raise exception 'INVALID_TIME'; end if;
     elapsed_ms:=(event->>'ms')::integer;
     if elapsed_ms<cell_times[event_step+1] then raise exception 'INVALID_TIME'; end if;
     cell_times[event_step+1]:=elapsed_ms;
   end if;
   if (event->>'answer')::integer=digits[event_step+1] then
     question_ms:=question_ms+case when r.tight_time then least(greatest(elapsed_ms-2000,0),18000) else least(elapsed_ms,20000) end;
     solved[event_step+1]:=true;answered_count:=answered_count+1;
     if answered_count=array_length(digits,1) then
       time_penalty:=time_penalty+case when r.tight_time then question_ms*60/(18000*array_length(digits,1)) else question_ms/(5000*array_length(digits,1)) end;
       question_ms:=0;question_index:=question_index+1;answered_count:=0;
       if question_index<question_count then
         fact:=r.questions->question_index;digits:=public.gugudan_vertical_question_cells(fact,r.manual_zero,false);
         solved:=array_fill(false,array[array_length(digits,1)]);cell_times:=array_fill(0,array[array_length(digits,1)]);
       end if;
     end if;
   else wrong_count:=wrong_count+1; end if;
 end loop;
 if question_index<>question_count or answered_count<>0 then raise exception 'INCOMPLETE_RUN'; end if;
 points:=greatest(0,question_count*200-wrong_count*30-time_penalty);
 update public.gugudan_vertical_runs set finished_at=clock_timestamp(),score=points,mistakes=wrong_count,payload_hash=event_hash,
   skill_stats=case when r.manual_zero then public.gugudan_vertical_metrics_manual(r.questions,p_events) else public.gugudan_vertical_metrics(r.questions,p_events) end where id=p_id;
 return jsonb_build_object('id',p_id,'score',points);
end; $$;

create function public.gugudan_vertical_leaders_tight(p_count integer) returns jsonb
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
     where tight_time and finished_at>now()-interval '7 days' and jsonb_array_length(questions)=p_count
     order by student_number,score desc,finished_at,id
   ) best order by best.score desc,best.finished_at,best.student_number limit 5
 ) row;
 return result;
end; $$;

revoke all on function public.gugudan_vertical_begin_tight(integer,uuid,integer),public.gugudan_vertical_leaders_tight(integer) from public,anon,authenticated;
grant execute on function public.gugudan_vertical_begin_tight(integer,uuid,integer),public.gugudan_vertical_leaders_tight(integer) to service_role;
commit;
