begin isolation level repeatable read;
set local role service_role;
do $$
declare initial jsonb; observed jsonb; expected jsonb; category text; scopes jsonb; durations integer[]; counts integer[]; student integer;
begin
 select p.student_number into student from public.gugudan_players p
 order by (select count(*) from public.gugudan_vertical_runs v where v.student_number=p.student_number and v.finished_at is not null) desc,p.student_number limit 1;
 select jsonb_build_object(
  'players',(select jsonb_agg(to_jsonb(p) order by student_number) from public.gugudan_players p),
  'runs',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.gugudan_runs r),
  'weekly',(select coalesce(jsonb_agg(to_jsonb(w) order by student_number,duration),'[]') from public.gugudan_weekly_leaders w),
  'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by student_number),'[]') from public.gugudan_vertical_assignments a),
  'vertical',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.gugudan_vertical_runs v)) into initial;
 foreach category in array array['rush-1','rush-2','rush-3','vertical-5','vertical-10','all'] loop
  scopes:=case when category='all' then '["rush-1","rush-2","rush-3","vertical-5","vertical-10"]'::jsonb else jsonb_build_array(category) end;
  select coalesce(array_agg(right(s,1)::integer),'{}') into durations from jsonb_array_elements_text(scopes) s where s like 'rush-%';
  select coalesce(array_agg(substring(s from 10)::integer),'{}') into counts from jsonb_array_elements_text(scopes) s where s like 'vertical-%';
  expected:=jsonb_set(initial,'{players}',(select jsonb_agg(case when (p->>'student_number')::integer=student then
   jsonb_set(jsonb_set(p,'{sessions}',coalesce((select jsonb_agg(s order by ord) from jsonb_array_elements(p->'sessions') with ordinality v(s,ord) where not(s->>'mode'='rush' and (s->>'duration')::integer=any(durations))),'[]')),
   '{best}',(p->'best')-array(select d::text from unnest(durations) d)) else p end order by ord) from jsonb_array_elements(initial->'players') with ordinality v(p,ord)));
  expected:=jsonb_set(expected,'{runs}',coalesce((select jsonb_agg(r order by ord) from jsonb_array_elements(initial->'runs') with ordinality v(r,ord) where not((r->>'student_number')::integer=student and r->>'mode'='rush' and (r->>'duration')::integer=any(durations) and r->>'finished_at' is not null)),'[]'));
  expected:=jsonb_set(expected,'{weekly}',coalesce((select jsonb_agg(w order by ord) from jsonb_array_elements(initial->'weekly') with ordinality v(w,ord) where not((w->>'student_number')::integer=student and (w->>'duration')::integer=any(durations))),'[]'));
  expected:=jsonb_set(expected,'{vertical}',coalesce((select jsonb_agg(vr order by ord) from jsonb_array_elements(initial->'vertical') with ordinality v(vr,ord) where not((vr->>'student_number')::integer=student and vr->>'finished_at' is not null and jsonb_array_length(vr->'questions')=any(counts))),'[]'));
  begin
   perform public.gugudan_teacher_reset_scoped(student,scopes);
   perform public.gugudan_teacher_reset_scoped(student,scopes);
   select jsonb_build_object(
    'players',(select jsonb_agg(to_jsonb(p) order by student_number) from public.gugudan_players p),
    'runs',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.gugudan_runs r),
    'weekly',(select coalesce(jsonb_agg(to_jsonb(w) order by student_number,duration),'[]') from public.gugudan_weekly_leaders w),
    'assignments',(select coalesce(jsonb_agg(to_jsonb(a) order by student_number),'[]') from public.gugudan_vertical_assignments a),
    'vertical',(select coalesce(jsonb_agg(to_jsonb(v) order by id),'[]') from public.gugudan_vertical_runs v)) into observed;
   if observed is distinct from expected then raise exception 'SCOPED_RESET_MISMATCH: %',category;end if;
   raise exception using errcode='Z0001',message='ROLLBACK_VERIFIED_CASE';
  exception when sqlstate 'Z0001' then null;
  end;
 end loop;
 begin perform public.gugudan_teacher_reset_scoped(student,'[]');raise exception 'INVALID_ACCEPTED';exception when others then if sqlerrm<>'INVALID_RESET_SCOPES' then raise;end if;end;
 begin perform public.gugudan_teacher_reset_scoped(student,'["rush-1","rush-1"]');raise exception 'INVALID_ACCEPTED';exception when others then if sqlerrm<>'INVALID_RESET_SCOPES' then raise;end if;end;
 begin perform public.gugudan_teacher_reset_scoped(24,'["rush-1"]');raise exception 'INVALID_ACCEPTED';exception when others then if sqlerrm<>'INVALID_STUDENT' then raise;end if;end;
end; $$;
select '5 single categories + combined reset, retries, global preservation and invalid inputs passed; all changes rolled back' as verification;
rollback;
