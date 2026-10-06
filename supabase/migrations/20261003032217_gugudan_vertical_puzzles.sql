begin;
create function public.gugudan_vertical_cell_ids(p_a integer,p_b integer,p_manual boolean) returns text[]
language plpgsql immutable security invoker set search_path='' as $$
declare ids text[]:='{}'; shift integer; row_name text; multiplier integer; carry integer; tens_value integer;
 first_value integer; second_value integer; total integer; place integer; width integer;
begin
 if p_a is null or p_b is null or p_a not between 10 and 99 or p_b not between 10 and 99 then raise exception 'INVALID_FACT'; end if;
 for shift in 0..1 loop
   row_name:=case shift when 0 then 'ones' else 'tens' end;
   multiplier:=case shift when 0 then p_b%10 else p_b/10 end;
   carry:=((p_a%10)*multiplier)/10;
   if shift=1 and p_manual then ids:=array_append(ids,'tens:0'); end if;
   ids:=array_append(ids,row_name||':'||shift);
   if multiplier=0 then continue; end if;
   if carry>0 then ids:=array_append(ids,'carry-'||row_name||':'||(shift+1)); end if;
   tens_value:=(p_a/10)*multiplier+carry;
   ids:=array_append(ids,row_name||':'||(shift+1));
   if tens_value>=10 then ids:=array_append(ids,row_name||':'||(shift+2)); end if;
 end loop;
 first_value:=p_a*(p_b%10);second_value:=p_a*(p_b/10)*10;carry:=0;width:=length((p_a*p_b)::text);
 for place in 0..width-1 loop
   total:=first_value%10+second_value%10+carry;
   ids:=array_append(ids,'sum:'||place);carry:=total/10;
   if carry>0 and place<width-1 then ids:=array_append(ids,'carry-sum:'||(place+1)); end if;
   first_value:=first_value/10;second_value:=second_value/10;
 end loop;
 return ids;
end; $$;

create function public.gugudan_vertical_questions_puzzles(p_difficulty integer,p_count integer) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare questions jsonb; fact jsonb; ids text[]; holes text[]; row_name text; picked text; index integer; chosen integer[];
begin
 questions:=public.gugudan_vertical_questions_count(p_difficulty,p_count);
 if p_count<>10 or p_difficulty=1 then return questions; end if;
 select array_agg(n) into chosen from (select n from generate_series(0,9) positions(n) order by random() limit case p_difficulty when 2 then 3 else 5 end) selected;
 foreach index in array chosen loop
   fact:=questions->index;holes:='{}';
   ids:=public.gugudan_vertical_cell_ids((fact->>'a')::integer,(fact->>'b')::integer,true);
   foreach row_name in array case p_difficulty when 2 then array['ones','tens'] else array['ones','tens','sum'] end loop
     select id into picked from unnest(ids) candidates(id) where split_part(id,':',1)=row_name and id<>'tens:0' order by random() limit 1;
     holes:=array_append(holes,picked);
   end loop;
   questions:=jsonb_set(questions,array[index::text],fact||jsonb_build_object('holes',to_jsonb(holes)));
 end loop;
 return questions;
end; $$;

create function public.gugudan_vertical_question_cells(p_fact jsonb,p_manual boolean,p_skills boolean) returns integer[]
language plpgsql immutable security invoker set search_path='' as $$
declare cells integer[]; ids text[]; result integer[]:='{}'; hole text; index integer;
begin
 cells:=public.gugudan_vertical_cells((p_fact->>'a')::integer,(p_fact->>'b')::integer,p_manual,p_skills);
 if not (p_fact ? 'holes') then return cells; end if;
 ids:=public.gugudan_vertical_cell_ids((p_fact->>'a')::integer,(p_fact->>'b')::integer,p_manual);
 for hole in select value from jsonb_array_elements_text(p_fact->'holes') loop
   index:=array_position(ids,hole);
   if index is null then raise exception 'INVALID_HOLE'; end if;
   result:=array_append(result,cells[index]);
 end loop;
 return result;
end; $$;

create function public.gugudan_vertical_begin_puzzles(p_student integer,p_id uuid,p_count integer,p_timed boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen integer; r public.gugudan_vertical_runs; expected_count integer; hole_count integer;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null or p_count is null or p_count not in (5,10) or p_timed is null then raise exception 'INVALID_RUN'; end if;
 chosen:=(public.gugudan_vertical_assignment(p_student)->>'difficulty')::integer;
 insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,scoring_version,manual_zero)
 values(p_id,p_student,chosen,public.gugudan_vertical_questions_puzzles(chosen,p_count),case when p_timed then 2 else 1 end,true) on conflict do nothing;
 select * into r from public.gugudan_vertical_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 if jsonb_array_length(r.questions)<>p_count then raise exception 'RUN_COUNT_CONFLICT'; end if;
 expected_count:=case when p_count=10 then case r.difficulty when 2 then 3 when 3 then 5 else 0 end else 0 end;
 select count(*) into hole_count from jsonb_array_elements(r.questions) q where q ? 'holes';
 if not r.manual_zero or hole_count<>expected_count then raise exception 'RUN_MODE_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'studentNumber',p_student,'difficulty',r.difficulty,'questions',r.questions,'timeScoring',r.scoring_version=2,'manualZero',true,'puzzles',true);
end; $$;

create or replace function public.gugudan_vertical_metrics_manual(p_questions jsonb,p_events jsonb) returns jsonb
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
   digits:=public.gugudan_vertical_question_cells(fact,true,false);skills:=public.gugudan_vertical_question_cells(fact,true,true);
   correct:=(event->>'answer')::integer=digits[step_index+1];skill:=skills[step_index+1];
   totals[1]:=totals[1]+1;successes[1]:=successes[1]+case when correct then 1 else 0 end;
   if skill>1 then totals[skill]:=totals[skill]+1;successes[skill]:=successes[skill]+case when correct then 1 else 0 end; end if;
 end loop;
 return jsonb_build_object('first',jsonb_build_object('attempts',totals[1],'correct',successes[1]),'multiply',jsonb_build_object('attempts',totals[2],'correct',successes[2]),'sum',jsonb_build_object('attempts',totals[3],'correct',successes[3]));
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
     question_ms:=question_ms+least(elapsed_ms,20000);solved[event_step+1]:=true;
     answered_count:=answered_count+1;
     if answered_count=array_length(digits,1) then
       time_penalty:=time_penalty+question_ms/(5000*array_length(digits,1));question_ms:=0;
       question_index:=question_index+1;answered_count:=0;
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

revoke all on function public.gugudan_vertical_cell_ids(integer,integer,boolean),public.gugudan_vertical_questions_puzzles(integer,integer),public.gugudan_vertical_question_cells(jsonb,boolean,boolean),public.gugudan_vertical_begin_puzzles(integer,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.gugudan_vertical_cell_ids(integer,integer,boolean),public.gugudan_vertical_questions_puzzles(integer,integer),public.gugudan_vertical_question_cells(jsonb,boolean,boolean),public.gugudan_vertical_begin_puzzles(integer,uuid,integer,boolean) to service_role;
commit;
