begin;
set local role service_role;
do $$
declare difficulty integer; question_count integer; expected_holes integer; found_holes integer;
 questions jsonb; fact jsonb; run_id uuid; events jsonb; digits integer[]; q integer; s integer;
 result jsonb; again jsonb; total_cells integer; rejected boolean; initial jsonb;
begin
 initial:=public.gugudan_vertical_begin_variety(1,gen_random_uuid(),10,true);
 again:=public.gugudan_vertical_begin_variety(1,(initial->>'id')::uuid,10,true);
 if initial<>again or initial->>'puzzleOperands'<>'true' or initial->>'manualZero'<>'true' then raise exception 'BEGIN_RETRY_FAILED'; end if;
 for difficulty in 1..3 loop
   foreach question_count in array array[5,10] loop
     questions:=public.gugudan_vertical_questions_variety(difficulty,question_count);
     if (select count(*) from jsonb_array_elements(questions) f where (f->>'b')::integer%10=0)>1 then raise exception 'ZERO_CAP_FAILED'; end if;
     if difficulty=3 and question_count=10 and (select count(distinct case when f->'holes'->>0 like 'operand-a:%' then 'operand-a' else f->'holes'->>0 end) from jsonb_array_elements(questions) f where f ? 'holes')<>4 then raise exception 'VARIETY_PATTERN_FAILED'; end if;
     expected_holes:=case when question_count=10 then case difficulty when 2 then 3 when 3 then 5 else 0 end else 0 end;
     select count(*) into found_holes from jsonb_array_elements(questions) f where f ? 'holes';
     if found_holes<>expected_holes then raise exception 'PUZZLE_MIX_FAILED'; end if;
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
select 'puzzle mix, arbitrary hole order, timing, wrong penalty, incomplete rejection, begin/finish retry, metrics: passed' as verification;
rollback;
