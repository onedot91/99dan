-- Friend collection: one pick per level. A level is every 15 lifetime correct answers
-- (keep in sync with LEVEL_STEP in src/game/learning.ts). Level 1 grants the starter pick.
begin;
alter table public.gugudan_players
  add column friends jsonb not null default '[]' check(jsonb_typeof(friends)='array'),
  add column partner text;

create or replace function public.gugudan_profile(p_student integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('studentNumber',p_student,
   'avatar',(select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||p_student and not deleted),
   'records',coalesce(p.records,'{}'), 'sessions',coalesce(p.sessions,'[]'),
   'best',coalesce((select jsonb_agg(value order by key) from jsonb_each(p.best) where value->>'scoringVersion'='5'),'[]'),
   'friends',coalesce(p.friends,'[]'),'partner',p.partner)
 from (select p_student as n) input left join public.gugudan_players p on p.student_number=input.n
 where p_student between 1 and 23;
$$;

create or replace function public.gugudan_save_friends(p_student integer,p_friends jsonb,p_partner text) returns void
language plpgsql security invoker set search_path='' as $$
declare
 v_correct integer;
 v_count integer;
begin
 if p_student not between 1 and 23 or jsonb_typeof(p_friends)<>'array' then raise exception 'INVALID_FRIENDS'; end if;
 if exists(select 1 from jsonb_array_elements(p_friends) e where jsonb_typeof(e)<>'string' or e#>>'{}' !~ '^[a-z]+(\.[a-z]+){0,3}$') then raise exception 'INVALID_FRIENDS'; end if;
 select count(*) into v_count from jsonb_array_elements(p_friends) e having count(*)=count(distinct e#>>'{}');
 if v_count is null then raise exception 'DUPLICATE_FRIENDS'; end if;
 -- Evolutions need their parent in the same collection.
 if exists(select 1 from jsonb_array_elements_text(p_friends) id
   where id like '%.%' and not p_friends ? regexp_replace(id,'\.[a-z]+$','')) then raise exception 'MISSING_PARENT'; end if;
 if p_partner is not null and not p_friends ? p_partner then raise exception 'INVALID_PARTNER'; end if;
 insert into public.gugudan_players(student_number) values(p_student) on conflict do nothing;
 select coalesce(sum((r.value->>'correct')::integer),0) into v_correct
   from public.gugudan_players p,jsonb_each(p.records) r where p.student_number=p_student;
 if v_count>1+v_correct/15 then raise exception 'TOO_MANY_FRIENDS'; end if;
 update public.gugudan_players set friends=p_friends,partner=p_partner where student_number=p_student;
end; $$;

create or replace function public.gugudan_teacher_records() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'studentNumber',n,
   'records',coalesce(p.records,'{}'),
   'sessions',coalesce(p.sessions,'[]'),
   'best',coalesce((select jsonb_agg(value order by key) from jsonb_each(p.best) where value->>'scoringVersion'='5'),'[]'),
   'friends',coalesce(p.friends,'[]'),'partner',p.partner) order by n),'[]')
 from generate_series(1,23) n left join public.gugudan_players p on p.student_number=n;
$$;

-- Resetting records resets levels, so the friends earned from them go too.
create or replace function public.gugudan_teacher_reset(p_student integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_student is null or p_student not between 1 and 23 then raise exception 'INVALID_STUDENT'; end if;
 delete from public.gugudan_runs where student_number=p_student;
 delete from public.gugudan_weekly_leaders where student_number=p_student;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0,friends='[]',partner=null where student_number=p_student;
end; $$;

create or replace function public.gugudan_teacher_reset_all() returns void
language plpgsql security invoker set search_path='' as $$
begin
 delete from public.gugudan_runs where student_number between 1 and 23;
 delete from public.gugudan_weekly_leaders where student_number between 1 and 23;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0,friends='[]',partner=null where student_number between 1 and 23;
end; $$;

revoke all on function public.gugudan_save_friends(integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.gugudan_save_friends(integer,jsonb,text) to service_role;
commit;
