-- 기존 계단 기록을 유지하고 최근 7일 최고 층수로 순위를 정한다.
create or replace function public.gugudan_stairs_leaders() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]') from (
   select best.student_number as "studentNumber",best.score,best.height,best.solved as correct,
     (select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||best.student_number and not deleted) as avatar
   from (
     select distinct on(student_number) student_number,score,height,solved,finished_at
     from public.gugudan_stairs_runs
     where finished_at>now()-interval '7 days'
     order by student_number,height desc,finished_at,id
   ) best order by best.height desc,best.finished_at,best.student_number limit 5
 ) row;
$$;
