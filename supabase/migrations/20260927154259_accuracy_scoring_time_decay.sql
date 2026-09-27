begin;
create or replace function public.gugudan_profile(p_student integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('studentNumber',p_student,
   'avatar',(select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||p_student and not deleted),
   'records',coalesce(p.records,'{}'), 'sessions',coalesce(p.sessions,'[]'),
   'best',coalesce((select jsonb_agg(value order by key) from jsonb_each(p.best) where value->>'scoringVersion'='3'),'[]'))
 from (select p_student as n) input left join public.gugudan_players p on p.student_number=input.n
 where p_student between 1 and 23;
$$;

create or replace function public.gugudan_leaders(p_duration integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]') from (
   select p.student_number as "studentNumber",(p.best->p_duration::text->>'score')::integer as score,
     (p.best->p_duration::text->>'correct')::integer as correct,
     (select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||p.student_number and not deleted) as avatar
   from public.gugudan_players p where p.best ? p_duration::text and p.best->p_duration::text->>'scoringVersion'='3' and p_duration in (1,2,3)
   order by (p.best->p_duration::text->>'score')::integer desc,
     p.best->p_duration::text->>'achievedAt',p.student_number limit 3
 ) row;
$$;

create or replace function public.gugudan_finish(p_student integer,p_id uuid,p_ended_early boolean,p_events jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.gugudan_runs; p public.gugudan_players; e jsonb; old jsonb; recent jsonb;
 a integer; b integer; c integer; d integer; answer integer; ms integer; kind text; fact text; question_key text; previous_fact text; previous_correct boolean:=true;
 correct boolean; fast boolean; streak integer; interval_size integer; combo integer:=0; best_combo integer:=0;
 score integer:=0; correct_count integer:=0; attempts integer:=0; fastest integer; event_hash text; summary jsonb;
begin
 if p_ended_early is null or coalesce(jsonb_typeof(p_events),'')<>'array' or jsonb_array_length(p_events)>1200 then raise exception 'INVALID_EVENTS'; end if;
 select * into r from public.gugudan_runs where id=p_id and student_number=p_student for update;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 event_hash:=md5(jsonb_build_array(p_ended_early,p_events)::text);
 if r.finished_at is not null then
   if r.payload_hash=event_hash then return; end if;
   raise exception 'RUN_ALREADY_FINISHED';
 end if;
 if r.mode='rush' and not p_ended_early and clock_timestamp()<r.started_at+make_interval(secs=>r.duration*60-2) then raise exception 'RUN_TOO_EARLY'; end if;
 select * into p from public.gugudan_players where student_number=p_student for update;
 for e in select value from jsonb_array_elements(p_events) loop
   if coalesce(jsonb_typeof(e),'')<>'object' or not(e ?& array['a','b','answer','ms']) or coalesce(e->>'a','') !~ '^[2-9]$' or coalesce(e->>'b','') !~ '^[2-9]$' or coalesce(e->>'answer','') !~ '^[0-9]{1,2}$' or coalesce(e->>'ms','') !~ '^[0-9]{1,8}$' then raise exception 'INVALID_ANSWER'; end if;
   a:=(e->>'a')::integer;b:=(e->>'b')::integer;answer:=(e->>'answer')::integer;ms:=(e->>'ms')::integer;
   kind:=coalesce(e->>'kind','product');
   if kind not in ('product','missing-a','missing-b','compare') then raise exception 'INVALID_QUESTION'; end if;
   if kind='compare' then
     if coalesce(e->>'c','') !~ '^[2-9]$' or coalesce(e->>'d','') !~ '^[2-9]$' then raise exception 'INVALID_COMPARISON'; end if;
     c:=(e->>'c')::integer;d:=(e->>'d')::integer;
   else
     if e ? 'c' or e ? 'd' then raise exception 'INVALID_QUESTION'; end if;
     c:=null;d:=null;
   end if;
   if ms<1 or ms>86400000 then raise exception 'INVALID_TIME'; end if;
   question_key:=a||'×'||b||':'||kind||case when kind='compare' then ':'||c||'×'||d else '' end;
   if not previous_correct and previous_fact<>question_key then raise exception 'RETRY_REQUIRED'; end if;
   correct:=case kind when 'missing-a' then answer=a when 'missing-b' then answer=b when 'compare' then answer=case when a*b<c*d then 1 when a*b>c*d then 3 else 2 end else answer=a*b end;
   fast:=correct and ms<=3000;
   fact:=a||'×'||b;
   old:=coalesce(p.records->fact,'{"attempts":0,"correct":0,"wrong":0,"totalMs":0,"streak":0,"fastStreak":0,"recent":[],"interval":4}');
   streak:=case when fast then (old->>'fastStreak')::integer+1 else 0 end;
   interval_size:=case when correct then least(12,(old->>'interval')::integer+2) else 4 end;
   recent:=old->'recent'||jsonb_build_array(jsonb_build_object('correct',correct,'ms',ms));
   select jsonb_agg(value order by ord) into recent from jsonb_array_elements(recent) with ordinality v(value,ord) where ord>greatest(0,jsonb_array_length(recent)-5);
   p.records:=jsonb_set(p.records,array[fact],jsonb_build_object(
     'attempts',(old->>'attempts')::integer+1,'correct',(old->>'correct')::integer+correct::integer,
     'wrong',(old->>'wrong')::integer+(not correct)::integer,'totalMs',(old->>'totalMs')::bigint+ms,
     'streak',case when correct then (old->>'streak')::integer+1 else 0 end,'fastStreak',streak,'recent',recent,
     'interval',interval_size,'lastSeen',p.ordinal,'reviewAt',case when correct and (old->>'streak')::integer+1>=3 then null else p.ordinal+interval_size end));
   p.ordinal:=p.ordinal+1;attempts:=attempts+1;
   combo:=case when correct then combo+1 else 0 end;best_combo:=greatest(best_combo,combo);
   if correct then
     correct_count:=correct_count+1;fastest:=least(fastest,ms);
     score:=score+greatest(100,150-least(50,ms/250))+least(combo-1,5)*10;
   else
     score:=score-50;
   end if;
   previous_fact:=question_key;previous_correct:=correct;
 end loop;
 summary:=jsonb_build_object('id',p_id,'mode',r.mode,'duration',r.duration,'score',score,'correct',correct_count,'answered',attempts,'bestCombo',best_combo,'fastest',fastest,'accuracy',case when attempts=0 then 0 else round(100.0*correct_count/attempts) end,'endedEarly',p_ended_early,'scoringVersion',3);
 p.sessions:=p.sessions||jsonb_build_array(summary);
 select jsonb_agg(value order by ord) into p.sessions from jsonb_array_elements(p.sessions) with ordinality v(value,ord) where ord>greatest(0,jsonb_array_length(p.sessions)-20);
 if r.mode='rush' and not p_ended_early and (p.best->r.duration::text->>'scoringVersion' is distinct from '3' or score>(p.best->r.duration::text->>'score')::integer) then
   p.best:=jsonb_set(p.best,array[r.duration::text],jsonb_build_object('duration',r.duration,'score',score,'correct',correct_count,'achievedAt',clock_timestamp(),'scoringVersion',3));
 end if;
 update public.gugudan_players set records=p.records,sessions=p.sessions,best=p.best,ordinal=p.ordinal where student_number=p_student;
 update public.gugudan_runs set finished_at=clock_timestamp(),payload_hash=event_hash where id=p_id;
end; $$;

create or replace function public.gugudan_teacher_records() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'studentNumber',n,
   'records',coalesce(p.records,'{}'),
   'sessions',coalesce(p.sessions,'[]'),
   'best',coalesce((select jsonb_agg(value order by key) from jsonb_each(p.best) where value->>'scoringVersion'='3'),'[]')) order by n),'[]')
 from generate_series(1,23) n left join public.gugudan_players p on p.student_number=n;
$$;
commit;

