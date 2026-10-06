-- Fifth friend stage (신화): ids may now have five segments, e.g. slime.fire.wing.star.angel.
-- Only the id pattern widens ({0,3} -> {0,4}); parent check, duplicates and the level formula are unchanged,
-- so every saved 1-4 segment collection stays valid. Keep in sync with FRIENDS in src/game/friends.ts.
begin;
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
 -- Evolutions need their parent in the same collection; stripping the last segment works at every depth.
 if exists(select 1 from jsonb_array_elements_text(p_friends) id
   where id like '%.%' and not p_friends ? regexp_replace(id,'\.[a-z]+$','')) then raise exception 'MISSING_PARENT'; end if;
 if p_partner is not null and not p_friends ? p_partner then raise exception 'INVALID_PARTNER'; end if;
 insert into public.gugudan_players(student_number) values(p_student) on conflict do nothing;
 select coalesce(sum((r.value->>'correct')::integer),0) into v_correct
   from public.gugudan_players p,jsonb_each(p.records) r where p.student_number=p_student;
 select friends into v_existing from public.gugudan_players where student_number=p_student;
 v_level:=case when v_correct>=100 then 5+(v_correct-100)/50
   when v_correct>=60 then 4 when v_correct>=30 then 3 when v_correct>=10 then 2 else 1 end;
 if v_count>v_level and not v_existing @> p_friends then raise exception 'TOO_MANY_FRIENDS'; end if;
 update public.gugudan_players set friends=p_friends,partner=p_partner where student_number=p_student;
end; $$;
commit;
