begin;
set local role service_role;
do $$
declare operand_a integer; operand_b integer; direct_digits integer[]; direct_skills integer[]; multiplier integer; unit_value integer; carry_value integer; tens_value integer; expected_digits integer[]; expected_skills integer[]; skill integer;
 difficulty integer; question_count integer; expected_holes integer; found_holes integer;
 questions jsonb; fact jsonb; run_id uuid; events jsonb; digits integer[]; q integer; s integer;
 result jsonb; again jsonb; total_cells integer; rejected boolean; initial jsonb;
begin
 for operand_a in 10..99 loop
   for multiplier in 1..9 loop
     operand_b:=multiplier*10;unit_value:=(operand_a%10)*multiplier;carry_value:=unit_value/10;tens_value:=(operand_a/10)*multiplier+carry_value;
     expected_digits:=array[0,unit_value%10];skill:=case when carry_value>0 then 2 else 1 end;expected_skills:=array[1,skill];
     if carry_value>0 then expected_digits:=expected_digits||array[carry_value];expected_skills:=expected_skills||array[2];end if;
     expected_digits:=expected_digits||array[tens_value%10];expected_skills:=expected_skills||array[skill];
     if tens_value>=10 then expected_digits:=expected_digits||array[tens_value/10];expected_skills:=expected_skills||array[skill];end if;
     fact:=jsonb_build_object('a',operand_a,'b',operand_b,'directZero',true);
     direct_digits:=public.gugudan_vertical_question_cells(fact,true,false);direct_skills:=public.gugudan_vertical_question_cells(fact,true,true);
     if direct_digits<>expected_digits or direct_skills<>expected_skills then raise exception 'DIRECT_CELLS_MISMATCH';end if;
     fact:=fact-'directZero';
     if public.gugudan_vertical_question_cells(fact,true,false)<>public.gugudan_vertical_cells(operand_a,operand_b,true,false) then raise exception 'PREVIOUS_CELLS_CHANGED';end if;
   end loop;
 end loop;
 initial:=public.gugudan_vertical_begin_direct_zero(1,gen_random_uuid(),10,true);
 again:=public.gugudan_vertical_begin_direct_zero(1,(initial->>'id')::uuid,10,true);
 if initial<>again or initial->>'puzzleOperands'<>'true' or initial->>'directZero'<>'true' or initial->>'manualZero'<>'true' then raise exception 'BEGIN_RETRY_FAILED'; end if;
 for difficulty in 1..3 loop
   foreach question_count in array array[5,10] loop
     questions:=public.gugudan_vertical_questions_direct_zero(difficulty,question_count);
     if (select count(*) from jsonb_array_elements(questions) f where (f->>'b')::integer%10=0)>1 then raise exception 'ZERO_CAP_FAILED'; end if;
     if difficulty=3 and question_count=10 and (select count(distinct case when f->'holes'->>0 like 'operand-a:%' then 'operand-a' else f->'holes'->>0 end) from jsonb_array_elements(questions) f where f ? 'holes')<>4 then raise exception 'VARIETY_PATTERN_FAILED'; end if;
     expected_holes:=case when question_count=10 then case difficulty when 2 then 3 when 3 then 5 else 0 end else 0 end;
     select count(*) into found_holes from jsonb_array_elements(questions) f where f ? 'holes';
     if found_holes<>expected_holes then raise exception 'PUZZLE_MIX_FAILED'; end if;
     if exists(select 1 from jsonb_array_elements(questions) f where (f->>'b')::integer%10=0 and (f->'directZero' is distinct from 'true'::jsonb or f ? 'holes')) then raise exception 'DIRECT_MODE_FAILED';end if;
     if difficulty=1 and question_count=5 then
       select ordinality::integer-1 into q from jsonb_array_elements(questions) with ordinality f(value,ordinality) where public.gugudan_vertical_kind((value->>'a')::integer,(value->>'b')::integer)=2 limit 1;
       questions:=jsonb_set(questions,array[q::text],'{"a":66,"b":90,"directZero":true}'::jsonb);
     end if;
     run_id:=gen_random_uuid();
     insert into public.gugudan_vertical_runs(id,student_number,difficulty,questions,scoring_version,manual_zero)
       values(run_id,1,difficulty,questions,2,true);
     events:='[]';total_cells:=0;
     for q in 0..question_count-1 loop
       fact:=questions->q;digits:=public.gugudan_vertical_question_cells(fact,true,false);
       total_cells:=total_cells+array_length(digits,1);
       for s in select case when fact ? 'holes' then array_length(digits,1)-n else n-1 end from generate_series(1,array_length(digits,1)) n loop
         if q=0 and jsonb_array_length(events)=0 then
           events:=events||jsonb_build_array(jsonb_build_object('question',q,'step',s,'answer',(digits[s+1]+1)%10,'ms',9000));
         end if;
         events:=events||jsonb_build_array(jsonb_build_object('question',q,'step',s,'answer',digits[s+1],'ms',10000));
       end loop;
     end loop;
     rejected:=false;
     begin perform public.gugudan_vertical_finish(1,run_id,events-(-1));
     exception when others then if sqlerrm='INCOMPLETE_RUN' then rejected:=true;else raise;end if;end;
     if not rejected then raise exception 'INCOMPLETE_ACCEPTED'; end if;
     result:=public.gugudan_vertical_finish(1,run_id,events);
     if (result->>'score')::integer<>question_count*200-30-question_count*2 then raise exception 'SCORE_MISMATCH'; end if;
     again:=public.gugudan_vertical_finish(1,run_id,events);
     if result<>again then raise exception 'FINISH_RETRY_FAILED'; end if;
     if not exists(select 1 from public.gugudan_vertical_runs where id=run_id
       and (skill_stats->'first'->>'attempts')::integer=total_cells
       and (skill_stats->'first'->>'correct')::integer=total_cells-1) then raise exception 'METRICS_MISMATCH'; end if;
   end loop;
 end loop;
end; $$;
select '810 direct digits/skills, previous cells, puzzle mix, arbitrary hole order, timing, wrong penalty, incomplete rejection, begin/finish retry, metrics: passed' as verification;
rollback;
