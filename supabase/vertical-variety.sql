begin;
create or replace function public.gugudan_vertical_questions_variety(p_difficulty integer,p_count integer) returns jsonb
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
     from generate_series(10,99) operands_a(a) cross join generate_series(10,90,10) operands_b(b)
     where public.gugudan_vertical_kind(a,b)=zero_kind order by random() limit 1;
 end if;
 select jsonb_agg(selected.fact order by random()) into questions from (
   select jsonb_build_object('a',a,'b',b) as fact from (
     select a,b,kind,row_number() over(partition by kind order by random()) as ordinal
     from (select a,b,public.gugudan_vertical_kind(a,b) as kind
       from generate_series(10,99) operands_a(a) cross join generate_series(10,99) operands_b(b) where b%10<>0) classified
   ) candidates where ordinal<=counts[kind]-case when kind=zero_kind then 1 else 0 end
   union all select zero_fact where zero_fact is not null
 ) selected;
 if p_count<>10 or p_difficulty=1 then return questions; end if;
 select array_agg(kind) into patterns from (select kind from generate_series(0,3) kinds(kind) order by random()) shuffled;
 select array_agg(n) into chosen from (select n from generate_series(0,9) positions(n) order by random() limit case p_difficulty when 2 then 3 else 5 end) selected;
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

create or replace function public.gugudan_vertical_question_cells(p_fact jsonb,p_manual boolean,p_skills boolean) returns integer[]
language plpgsql immutable security invoker set search_path='' as $$
declare cells integer[]; ids text[]; result integer[]:='{}'; hole text; index integer; operand_value integer; place integer;
begin
 cells:=public.gugudan_vertical_cells((p_fact->>'a')::integer,(p_fact->>'b')::integer,p_manual,p_skills);
 if not (p_fact ? 'holes') then return cells; end if;
 ids:=public.gugudan_vertical_cell_ids((p_fact->>'a')::integer,(p_fact->>'b')::integer,p_manual);
 for hole in select value from jsonb_array_elements_text(p_fact->'holes') loop
   if hole in ('operand-a:0','operand-a:1','operand-b:0','operand-b:1') then
     operand_value:=case when split_part(hole,':',1)='operand-a' then (p_fact->>'a')::integer else (p_fact->>'b')::integer end;
     place:=split_part(hole,':',2)::integer;
     result:=array_append(result,case when p_skills then 1 when place=0 then operand_value%10 else operand_value/10 end);
   else
     index:=array_position(ids,hole);
     if index is null then raise exception 'INVALID_HOLE'; end if;
     result:=array_append(result,cells[index]);
   end if;
 end loop;
 return result;
end; $$;

create or replace function public.gugudan_vertical_begin_variety(p_student integer,p_id uuid,p_count integer,p_timed boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare chosen integer; r public.gugudan_vertical_runs; expected_count integer; hole_count integer;
begin
 if p_student is null or p_student not between 1 and 23 or p_id is null or p_count is null or p_count not in (5,10) or p_timed is null then raise exception 'INVALID_RUN'; end if;
 chosen:=(public.gugudan_vertical_assignment(p_student)->>'difficulty')::integer;
 insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,scoring_version,manual_zero)
 values(p_id,p_student,chosen,public.gugudan_vertical_questions_variety(chosen,p_count),case when p_timed then 2 else 1 end,true) on conflict do nothing;
 select * into r from public.gugudan_vertical_runs where id=p_id;
 if r.student_number<>p_student then raise exception 'RUN_CONFLICT'; end if;
 if jsonb_array_length(r.questions)<>p_count then raise exception 'RUN_COUNT_CONFLICT'; end if;
 expected_count:=case when p_count=10 then case r.difficulty when 2 then 3 when 3 then 5 else 0 end else 0 end;
 select count(*) into hole_count from jsonb_array_elements(r.questions) q where q ? 'holes';
 if not r.manual_zero or hole_count<>expected_count then raise exception 'RUN_MODE_CONFLICT'; end if;
 return jsonb_build_object('id',r.id,'studentNumber',p_student,'difficulty',r.difficulty,'questions',r.questions,'timeScoring',r.scoring_version=2,'manualZero',true,'puzzles',true,'puzzleOperands',true);
end; $$;
revoke all on function public.gugudan_vertical_questions_variety(integer,integer),public.gugudan_vertical_begin_variety(integer,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.gugudan_vertical_questions_variety(integer,integer),public.gugudan_vertical_begin_variety(integer,uuid,integer,boolean) to service_role;
commit;
