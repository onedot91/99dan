begin;
create or replace function public.gugudan_leaders(p_duration integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]') from (
   select p.student_number as "studentNumber",(p.best->p_duration::text->>'score')::integer as score,
     (p.best->p_duration::text->>'correct')::integer as correct,
     (select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||p.student_number and not deleted) as avatar
   from public.gugudan_players p where p.best ? p_duration::text and p.best->p_duration::text->>'scoringVersion'='4' and p_duration in (1,2,3)
   order by (p.best->p_duration::text->>'score')::integer desc,
     p.best->p_duration::text->>'achievedAt',p.student_number limit 5
 ) row;
$$;
commit;

