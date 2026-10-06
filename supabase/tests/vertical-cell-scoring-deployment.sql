begin isolation level repeatable read;
set local role service_role;
do $$
declare mode integer; n integer; d integer; seconds integer; q integer; s integer; checked integer:=0;
 run_id uuid; started jsonb; receipt jsonb; events jsonb; fact jsonb; digits integer[]; expected integer; cell_total integer; base_points integer;
begin
 if exists(select 1 from (values('anon'),('authenticated')) roles(role)
  where has_function_privilege(role,'public.gugudan_vertical_begin_cells(integer,uuid,integer)','execute')
    or has_function_privilege(role,'public.gugudan_vertical_leaders_cells(integer)','execute')) then
  raise exception 'PUBLIC_RPC_ACCESS';
 end if;
 for mode in 0..3 loop
  foreach n in array array[5,10] loop
   for d in 1..3 loop
    perform public.gugudan_teacher_set_vertical(23,d);
    for seconds in 1..20 loop
     run_id:=gen_random_uuid();
     if mode=3 then
      started:=public.gugudan_vertical_begin_cells(23,run_id,n);
      if started->>'cellScoring'<>'true' then raise exception 'MISSING_CELL_FLAG'; end if;
      if public.gugudan_vertical_begin_cells(23,run_id,n)<>started then raise exception 'BEGIN_NOT_IDEMPOTENT'; end if;
     elsif mode=2 then
      started:=public.gugudan_vertical_begin_tight(23,run_id,n);
      if started->>'tightTime'<>'true' then raise exception 'MISSING_FLAG'; end if;
      if public.gugudan_vertical_begin_tight(23,run_id,n)<>started then raise exception 'BEGIN_NOT_IDEMPOTENT'; end if;
     else
      started:=public.gugudan_vertical_begin_direct_zero(23,run_id,n,mode=1);
     end if;
     events:='[]'::jsonb;cell_total:=0;
     for q in 0..n-1 loop
      fact:=started->'questions'->q;
      digits:=public.gugudan_vertical_question_cells(fact,true,false);
      for s in 1..array_length(digits,1) loop
       base_points:=s*200/array_length(digits,1)-(s-1)*200/array_length(digits,1);
       cell_total:=cell_total+greatest(1,base_points*(100-(greatest(seconds,2)-2)*5)/100);
       if q=0 and s=1 then
        events:=events||jsonb_build_array(jsonb_build_object('question',q,'step',s-1,'answer',(digits[s]+1)%10,'ms',0));
       end if;
       events:=events||jsonb_build_array(jsonb_build_object('question',q,'step',s-1,'answer',digits[s],'ms',seconds*1000));
      end loop;
     end loop;
     expected:=case when mode=3 then cell_total-10 else n*(200-case when mode=2 then greatest(seconds-2,0)*60/18 when mode=1 then seconds/5 else 0 end)-30 end;
     receipt:=public.gugudan_vertical_finish(23,run_id,events);
     if (receipt->>'score')::integer<>expected then raise exception 'SCORE_MISMATCH'; end if;
     if public.gugudan_vertical_finish(23,run_id,events)<>receipt then raise exception 'FINISH_NOT_IDEMPOTENT'; end if;
     if mode<>3 then
      begin
       perform public.gugudan_vertical_begin_cells(23,run_id,n);
       raise exception 'ACCEPTED_OLD_CELL_ID';
      exception when others then if sqlerrm<>'RUN_MODE_CONFLICT' then raise; end if; end;
     else
      begin
       perform public.gugudan_vertical_begin_tight(23,run_id,n);
       raise exception 'ACCEPTED_NEW_ID_IN_OLD_MODE';
      exception when others then if sqlerrm<>'RUN_MODE_CONFLICT' then raise; end if; end;
     end if;
     if mode not in (2,3) then
      begin
       perform public.gugudan_vertical_begin_tight(23,run_id,n);
       raise exception 'ACCEPTED_OLD_ID';
      exception when others then if sqlerrm<>'RUN_MODE_CONFLICT' then raise; end if; end;
     end if;
     checked:=checked+1;
    end loop;
   end loop;
  end loop;
 end loop;
 foreach n in array array[5,10] loop
  if not exists(select 1 from jsonb_array_elements(public.gugudan_vertical_leaders_cells(n)) leader
    where (leader->>'studentNumber')::integer=23 and (leader->>'score')::integer>=n*200-10) then
   raise exception 'CELL_RANKING_MISMATCH';
  end if;
 end loop;
 if checked<>480 then raise exception 'WRONG_CHECK_COUNT'; end if;
end $$;
select jsonb_build_object('cases',480,'passed',true,'fixtures','rolled back below') as verification;
rollback;

