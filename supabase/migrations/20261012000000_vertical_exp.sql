-- Two-digit (vertical) runs now earn level experience: 20 per finished question, against 1 per correct
-- times-table answer. Keep in sync with VERTICAL_EXP_PER_QUESTION in src/game/learning.ts.
begin;
create or replace function public.gugudan_vertical_exp(p_student integer) returns integer
language sql stable security invoker set search_path='' as $$
 select coalesce(sum(jsonb_array_length(questions)),0)::integer*20
 from public.gugudan_vertical_runs where student_number=p_student and finished_at is not null;
$$;
revoke all on function public.gugudan_vertical_exp(integer) from public,anon,authenticated;
grant execute on function public.gugudan_vertical_exp(integer) to service_role;

create or replace function public.gugudan_profile(p_student integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('studentNumber',p_student,
   'avatar',(select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||p_student and not deleted),
   'records',coalesce(p.records,'{}'), 'sessions',coalesce(p.sessions,'[]'),
   'best',coalesce((select jsonb_agg(value order by key) from jsonb_each(p.best) where value->>'scoringVersion'='5'),'[]'),
   'friends',coalesce(p.friends,'[]'),'partner',p.partner,
   'verticalExp',public.gugudan_vertical_exp(p_student))
 from (select p_student as n) input left join public.gugudan_players p on p.student_number=input.n
 where p_student between 1 and 23;
$$;

create or replace function public.gugudan_save_friends(p_student integer,p_friends jsonb,p_partner text) returns void
language plpgsql security invoker set search_path='' as $$
declare
 v_correct integer;
 v_count integer;
 v_existing jsonb;
 v_level integer;
begin
 if p_student not between 1 and 23 or jsonb_typeof(p_friends)<>'array' then raise exception 'INVALID_FRIENDS'; end if;
 if exists(select 1 from jsonb_array_elements(p_friends) e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^[a-z]+(\.[a-z]+){0,4}$') then raise exception 'INVALID_FRIENDS'; end if;
 select count(*) into v_count from jsonb_array_elements(p_friends) e having count(*)=count(distinct e#>>'{}');
 if v_count is null then raise exception 'DUPLICATE_FRIENDS'; end if;
 if exists(select 1 from jsonb_array_elements_text(p_friends) id
   where id like '%.%' and not p_friends ? regexp_replace(id,'\.[a-z]+$','')) then raise exception 'MISSING_PARENT'; end if;
 if p_partner is not null and not p_friends ? p_partner then raise exception 'INVALID_PARTNER'; end if;
 insert into public.gugudan_players(student_number) values(p_student) on conflict do nothing;
 select coalesce(sum((r.value->>'correct')::integer),0) into v_correct
   from public.gugudan_players p,jsonb_each(p.records) r where p.student_number=p_student;
 v_correct:=v_correct+public.gugudan_vertical_exp(p_student);
 select friends into v_existing from public.gugudan_players where student_number=p_student;
 v_level:=case when v_correct>=100 then 5+(v_correct-100)/50
   when v_correct>=60 then 4 when v_correct>=30 then 3 when v_correct>=10 then 2 else 1 end;
 if v_count>v_level and not v_existing @> p_friends then raise exception 'TOO_MANY_FRIENDS'; end if;
 update public.gugudan_players set friends=p_friends,partner=p_partner where student_number=p_student;
end; $$;
commit;
