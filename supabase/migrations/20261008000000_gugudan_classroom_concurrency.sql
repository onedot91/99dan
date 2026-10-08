-- Classroom concurrency fixes (2026-10-08).
-- 1. A full rush is no longer rejected as RUN_TOO_EARLY when the start request reached the database late:
--    the client reports how long the run had been going when it sent the start, the start time is set back by
--    that much (capped), and the finish check allows 10 seconds of network/queue skew instead of 2.
-- 2. Two-digit question selection reads a precomputed kind table instead of classifying 8,100 pairs per start.
--    The table holds exactly gugudan_vertical_kind(a,b), so the questions drawn are unchanged.
begin;
create table public.gugudan_vertical_fact_kinds (
  a smallint not null check(a between 10 and 99),
  b smallint not null check(b between 10 and 99),
  kind smallint not null check(kind between 1 and 3),
  primary key(a,b)
);
insert into public.gugudan_vertical_fact_kinds(a,b,kind)
select a,b,public.gugudan_vertical_kind(a,b) from generate_series(10,99) operands_a(a) cross join generate_series(10,99) operands_b(b);
alter table public.gugudan_vertical_fact_kinds enable row level security;
revoke all on public.gugudan_vertical_fact_kinds from public,anon,authenticated;
grant select on public.gugudan_vertical_fact_kinds to service_role;

create or replace function public.gugudan_vertical_questions_direct_zero(p_difficulty integer,p_count integer) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare counts integer[]; zero_kind integer; zero_fact jsonb; questions jsonb;
 patterns integer[]; chosen integer[]; puzzle_index integer:=0; question_index integer;
 pattern integer; fact jsonb; ids text[]; holes text[]; row_name text; rows text[]; picked text;
begin
 if p_difficulty is null or p_difficulty not between 1 and 3 or p_count is null or p_count not in (5,10) then raise exception 'INVALID_RUN'; end if;
 counts:=case p_difficulty when 1 then array[2,2,1] when 2 then array[1,2,2] else array[0,1,4] end;
 if p_count=10 then counts:=array[counts[1]*2,counts[2]*2,counts[3]*2]; end if;
 if random()<.25 then
   select kind into zero_kind from generate_series(1,2) kinds(kind) where counts[kind]>0 order by random() limit 1;
   select jsonb_build_object('a',a,'b',b) into zero_fact
     from public.gugudan_vertical_fact_kinds where b%10=0 and kind=zero_kind order by random() limit 1;
 end if;
 select jsonb_agg(selected.fact order by random()) into questions from (
   select jsonb_build_object('a',a,'b',b) as fact from (
     select a,b,kind,row_number() over(partition by kind order by random()) as ordinal
     from (select a,b,kind from public.gugudan_vertical_fact_kinds where b%10<>0) classified
   ) candidates where ordinal<=counts[kind]-case when kind=zero_kind then 1 else 0 end
   union all select zero_fact where zero_fact is not null
 ) selected;
 select jsonb_agg(case when (q->>'b')::integer%10=0 then q||jsonb_build_object('directZero',true) else q end order by n) into questions from jsonb_array_elements(questions) with ordinality items(q,n);
 if p_count<>10 or p_difficulty=1 then return questions; end if;
 select array_agg(kind) into patterns from (select kind from generate_series(0,3) kinds(kind) order by random()) shuffled;
 select array_agg(n) into chosen from (select n from generate_series(0,9) positions(n) where (questions->n->>'b')::integer%10<>0 order by random() limit case p_difficulty when 2 then 3 else 5 end) selected;
 foreach question_index in array chosen loop
   pattern:=patterns[(puzzle_index%4)+1];puzzle_index:=puzzle_index+1;
   fact:=questions->question_index;holes:='{}';
   ids:=public.gugudan_vertical_cell_ids((fact->>'a')::integer,(fact->>'b')::integer,true)||array['operand-a:0','operand-a:1','operand-b:0','operand-b:1'];
   rows:=case pattern when 1 then array['operand-a','ones'] when 2 then array['operand-b','tens'] when 3 then array['operand-b','ones'] else array['ones','tens'] end;
   if p_difficulty=3 then rows:=rows||array['sum']; end if;
   foreach row_name in array rows loop
     select id into picked from unnest(ids) candidates(id)
       where split_part(id,':',1)=row_name and id<>'tens:0'
         and (row_name<>'operand-b' or id=case pattern when 2 then 'operand-b:0' else 'operand-b:1' end)
       order by random() limit 1;
     holes:=array_append(holes,picked);
   end loop;
   questions:=jsonb_set(questions,array[question_index::text],fact||jsonb_build_object('holes',to_jsonb(holes)));
 end loop;
 return questions;
end; $$;

drop function public.gugudan_begin(integer,uuid,text,integer);
create function public.gugudan_begin(p_student integer,p_id uuid,p_mode text,p_duration integer,p_elapsed_ms integer default null) returns void
language plpgsql security invoker set search_path='' as $$
declare existing public.gugudan_runs; elapsed integer;
begin
 if p_student not between 1 and 23 or p_mode not in ('rush','practice','weak') or p_duration not in (1,2,3) then raise exception 'INVALID_RUN'; end if;
 -- How long the run had already been playing when the client sent this start (0 for old clients), at most the run plus a minute.
 elapsed:=least(greatest(coalesce(p_elapsed_ms,0),0),p_duration*60000+60000);
 insert into public.gugudan_players(student_number) values(p_student) on conflict do nothing;
 insert into public.gugudan_runs(id,student_number,mode,duration,started_at)
 values(p_id,p_student,p_mode,p_duration,clock_timestamp()-make_interval(secs=>elapsed/1000.0)) on conflict do nothing;
 select * into existing from public.gugudan_runs where id=p_id;
 if existing.student_number<>p_student or existing.mode<>p_mode or existing.duration<>p_duration then raise exception 'RUN_CONFLICT'; end if;
end; $$;

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
 if r.mode='rush' and not p_ended_early and clock_timestamp()<r.started_at+make_interval(secs=>r.duration*60-10) then raise exception 'RUN_TOO_EARLY'; end if;
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
     score:=score+greatest(100,200-least(100,ms/100))+least(combo-1,5)*10;
   else
     score:=greatest(0,score-30);
   end if;
   previous_fact:=question_key;previous_correct:=correct;
 end loop;
 summary:=jsonb_build_object('id',p_id,'mode',r.mode,'duration',r.duration,'score',score,'correct',correct_count,'answered',attempts,'bestCombo',best_combo,'fastest',fastest,'accuracy',case when attempts=0 then 0 else round(100.0*correct_count/attempts) end,'endedEarly',p_ended_early,'scoringVersion',5);
 p.sessions:=p.sessions||jsonb_build_array(summary);
 select jsonb_agg(value order by ord) into p.sessions from jsonb_array_elements(p.sessions) with ordinality v(value,ord) where ord>greatest(0,jsonb_array_length(p.sessions)-20);
 if r.mode='rush' and (p.best->r.duration::text->>'scoringVersion' is distinct from '5' or score>(p.best->r.duration::text->>'score')::integer) then
   p.best:=jsonb_set(p.best,array[r.duration::text],jsonb_build_object('duration',r.duration,'score',score,'correct',correct_count,'achievedAt',clock_timestamp(),'scoringVersion',5));
 end if;
 update public.gugudan_players set records=p.records,sessions=p.sessions,best=p.best,ordinal=p.ordinal where student_number=p_student;
 update public.gugudan_runs set finished_at=clock_timestamp(),payload_hash=event_hash where id=p_id;
end; $$;

revoke all on function public.gugudan_begin(integer,uuid,text,integer,integer),public.gugudan_finish(integer,uuid,boolean,jsonb),public.gugudan_vertical_questions_direct_zero(integer,integer) from public,anon,authenticated;
grant execute on function public.gugudan_begin(integer,uuid,text,integer,integer),public.gugudan_finish(integer,uuid,boolean,jsonb),public.gugudan_vertical_questions_direct_zero(integer,integer) to service_role;
commit;
